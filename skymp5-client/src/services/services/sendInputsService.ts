import { ClientListener, CombinedController, Sp } from "./clientListener";
import { SinglePlayerService } from "./singlePlayerService";
import { FormModel, WorldModel } from "../../view/model";
import { MsgType } from "../../messages";
import { getMovement } from "../../sync/movementGet";

// TODO: refactor this out
import * as worldViewMisc from "../../view/worldViewMisc";

import { Animation, AnimationSource } from "../../sync/animation";
import { Actor, EquipEvent, FormType } from "skyrimPlatform";
import { getAppearance } from "../../sync/appearance";
import { ActorValues, getActorValues } from "../../sync/actorvalues";
import { getEquipment } from "../../sync/equipment";
import { nextHostAttempt } from "../../view/hostAttempts";
import { SkympClient } from "./skympClient";
import { MessageWithRefrId } from "../events/sendMessageWithRefrIdEvent";
import { UpdateMovementMessage } from "../messages/updateMovementMessage";
import { ChangeValuesMessage } from "../messages/changeValuesMessage";
import { UpdateAnimationMessage } from "../messages/updateAnimationMessage";
import { UpdateEquipmentMessage } from "../messages/updateEquipmentMessage";
import { UpdateAppearanceMessage } from "../messages/updateAppearanceMessage";
import { RemoteServer } from "./remoteServer";
import { DeathService } from "./deathService";
import { logError, logTrace } from "../../logging";
import { AuthGameData, authGameDataStorageKey } from "../../features/authModel";
import { SettingsService } from "./settingsService";

const playerFormId = 0x14;

// TODO: split this service into EquipmentService, MovementService, AnimationService, ActorValueService, HostAttemptsService
export class SendInputsService extends ClientListener {
    constructor(private sp: Sp, private controller: CombinedController) {
        super();
        this.controller.on("update", () => this.onUpdate());
        this.controller.on("equip", (e) => this.onEquip(e));
        this.controller.on("unequip", (e) => this.onUnequip(e));
        this.controller.on("loadGame", () => this.onLoadGame());
    }

    private onUpdate() {
        this.flushDeferredCharacterNameReject();
        this.enforceCharacterNameRetry();

        if (!this.singlePlayerService.isSinglePlayer) {
            this.sendInputs();

            const player = this.sp.Game.getPlayer()!;
            const isPlayerCasting = player.getAnimationVariableBool("IsCastingRight")
                || player.getAnimationVariableBool("IsCastingLeft")
                || player.getAnimationVariableBool("IsCastingDual");

            if (isPlayerCasting) {
                this.prevCastingDetectedTime = Date.now();
            }
        }
    }

    private onEquip(event: EquipEvent) {
        if (!event.actor || !event.baseObj) {
            return;
        }

        if (event.actor.getFormID() !== playerFormId) {
            return;
        }

        const type = event.baseObj.getType();
        if (type !== FormType.Book && type !== FormType.Potion && type !== FormType.Ingredient) {
            // Trigger UpdateEquipment only for equips that are not spell tomes, potions, ingredients
            this.equipmentChanged = true;
        }

        // Send OnEquip for any equips including spell tomes, potions, ingredients
        // Otherwise, the server won't trigger spell learn, potion drink, ingredient eat and Papyrus scripts
        this.controller.emitter.emit("sendMessage", {
            message: { t: MsgType.OnEquip, baseId: event.baseObj.getFormID() },
            reliability: "unreliable"
        });
    }

    private onUnequip(event: EquipEvent) {
        if (!event.actor || !event.baseObj) {
            return;
        }

        if (event.actor.getFormID() === playerFormId) {
            this.equipmentChanged = true;
        }
    }

    private onLoadGame() {
        // Currently only armor is equipped after relogging (see remoteServer.ts)
        // This hack forces sending /equipment without weapons/ back to the server
        this.sp.Utility.wait(3).then(() => (this.equipmentChanged = true));
    }

    private sendInputs() {
        const hosted =
            typeof this.sp.storage['hosted'] === typeof [] ? this.sp.storage['hosted'] : [];
        const targets = [undefined].concat(hosted as any);

        const modelSource = this.controller.lookupListener(RemoteServer);

        const world = modelSource.getWorldModel();

        targets.forEach((target) => {
            const targetFormModel = target ? this.getForm(target, world) : this.getForm(undefined, world);
            this.sendMovement(target, targetFormModel);
            this.sendAnimation(target);
            this.sendAppearance(target);
            this.sendEquipment(target);
            this.sendActorValuePercentage(target, targetFormModel);
        });
        this.sendHostAttempts();
    }

    private sendMovement(_refrId?: number, form?: FormModel) {
        const owner = this.getInputOwner(_refrId);
        if (!owner) {
          return;
        }

        const refrIdStr = `${_refrId}`;
        const sendMovementRateMs = 130;
        const now = Date.now();
        const last = this.lastSendMovementMoment.get(refrIdStr);
        if (!last || now - last > sendMovementRateMs) {
            const message: MessageWithRefrId<UpdateMovementMessage> = {
                t: MsgType.UpdateMovement,
                data: getMovement(owner, form),
                _refrId
            };
            this.controller.emitter.emit("sendMessageWithRefrId", {
                message,
                reliability: "unreliable"
            });
            this.lastSendMovementMoment.set(refrIdStr, now);
        }
    }

    private sendActorValuePercentage(_refrId?: number, form?: FormModel) {
        const canSend = form && (form.isDead ?? false) === false;
        if (!canSend) {
          return;
        }

        const owner = this.getInputOwner(_refrId);
        if (!owner) {
          return;
        }

        const av = getActorValues(this.sp.Game.getPlayer() as Actor);
        const currentTime = Date.now();
        if (
            this.actorValuesNeedUpdate === false &&
            this.prevValues.health === av.health &&
            this.prevValues.stamina === av.stamina &&
            this.prevValues.magicka === av.magicka
        ) {
            return;
        }


        if (
            currentTime - this.prevActorValuesUpdateTime < 2000 &&
            this.actorValuesNeedUpdate === false
        ) {
            return;
        }

        // Delaying actor values update due to casting
        // TODO: use partial updates for actor values once server finally supports it
        // i.e. keep sending health and stamina during casting, but delay magicka update
        if (
            currentTime - this.prevCastingDetectedTime < 500 &&
            av.health > 0 // don't delay death actor value update
        ) {
            return;
        }

        const deathService = this.controller.lookupListener(DeathService);
        if (deathService.isBusy()) {
            logTrace(this, "Not sending actor values, death service is busy");
            return;
        }

        const message: MessageWithRefrId<ChangeValuesMessage> = {
            t: MsgType.ChangeValues,
            data: av,
            _refrId
        };
        this.controller.emitter.emit("sendMessageWithRefrId", {
            message,
            reliability: "unreliable"
        });
        this.actorValuesNeedUpdate = false;
        this.prevValues = av;
        this.prevActorValuesUpdateTime = currentTime;

    }

    private sendAnimation(_refrId?: number) {
        const owner = this.getInputOwner(_refrId);
        if (!owner) {
          return;
        }

        // Extermly important that it's a local id since AnimationSource depends on it
        const refrIdStr = owner.getFormID().toString(16);

        let animSource = this.playerAnimSource.get(refrIdStr);
        if (!animSource) {
            animSource = new AnimationSource(owner);
            this.playerAnimSource.set(refrIdStr, animSource);
        }
        const anim = animSource.getAnimation();

        const lastAnimationSent = this.lastAnimationSent.get(refrIdStr);
        if (
            !lastAnimationSent ||
            anim.numChanges !== lastAnimationSent.numChanges
        ) {
            // Drink potion anim from this mod https://www.nexusmods.com/skyrimspecialedition/mods/97660
            if (anim.animEventName !== '' && !anim.animEventName.startsWith("DrinkPotion_")) {
                this.lastAnimationSent.set(refrIdStr, anim);
                this.updateActorValuesAfterAnimation(anim.animEventName);
                const message: MessageWithRefrId<UpdateAnimationMessage> = {
                    t: MsgType.UpdateAnimation,
                    data: anim,
                    _refrId
                };
                this.controller.emitter.emit("sendMessageWithRefrId", {
                    message,
                    reliability: "unreliable"
                });
            }
        }
    }

    private sendAppearance(_refrId?: number) {
        if (_refrId) {
          return;
        }
        const shown = this.sp.Ui.isMenuOpen('RaceSex Menu');
        if (shown != this.isRaceSexMenuShown) {
            this.isRaceSexMenuShown = shown;
            if (!shown) {
                this.sp.printConsole('Exited from race menu');

                const appearance = getAppearance(this.sp.Game.getPlayer() as Actor);
                const authGameData = this.sp.storage[authGameDataStorageKey] as AuthGameData | undefined;
                const remoteAuth = authGameData?.remote;
                const selectedCharacterId = Number(remoteAuth?.selectedCharacterId);
                const submittedName = `${appearance.name || ""}`.trim();

                if (Number.isInteger(selectedCharacterId) && submittedName) {
                    this.pendingCharacterNameFinalize = true;
                    this.finalizeSelectedCharacterName(selectedCharacterId, submittedName, (finalizedName) => {
                        this.pendingCharacterNameFinalize = false;
                        this.clearCharacterNameRetry();
                        const storedAuthGameData = this.sp.storage[authGameDataStorageKey] as AuthGameData | undefined;
                        if (storedAuthGameData?.remote) {
                            storedAuthGameData.remote.selectedCharacterName = finalizedName;
                        }
                        this.applyApprovedCharacterNameLocally(finalizedName);
                        appearance.name = finalizedName;
                        this.sendAppearanceMessage(appearance, _refrId);
                    }, (error) => {
                        this.pendingCharacterNameFinalize = false;
                        this.armCharacterNameRetry();
                        logError(this, "Failed to finalize UCP character name", error);
                        this.deferredCharacterNameRejectMessage = `${error}`.trim() || "Character name was rejected";
                    });
                    return;
                }

                this.sendAppearanceMessage(appearance, _refrId);
            }
        }
    }

    private sendAppearanceMessage(appearance: ReturnType<typeof getAppearance>, _refrId?: number) {
        const message: MessageWithRefrId<UpdateAppearanceMessage> = {
            t: MsgType.UpdateAppearance,
            data: appearance,
            _refrId
        };
        this.controller.emitter.emit("sendMessageWithRefrId", {
            message,
            reliability: "reliable"
        });
    }

    private finalizeSelectedCharacterName(characterId: number, name: string, onSuccess: (finalizedName: string) => void, onError: (error: string) => void) {
        const authGameData = this.sp.storage[authGameDataStorageKey] as AuthGameData | undefined;
        const session = authGameData?.remote?.session;
        if (!session) {
            onError("Missing UCP session");
            return;
        }

        const client = new this.sp.HttpClient(this.controller.lookupListener(SettingsService).getServerUiUrl());
        client.post("/ucp/api/characters/finalize-name", {
            body: JSON.stringify({
                characterId,
                name,
            }),
            contentType: "application/json",
            headers: {
                authorization: `Bearer ${session}`,
            },
            // @ts-ignore main-menu-safe callback overload
        }, (response) => {
            if (response.status !== 200) {
                onError(this.parseHttpError(response));
                return;
            }

            try {
                const payload = JSON.parse(response.body || "{}");
                const finalizedName = `${payload?.character?.name || name}`.trim();
                if (!finalizedName) {
                    onError("Character name was not saved");
                    return;
                }
                onSuccess(finalizedName);
            } catch (error) {
                onError(`${error}`);
            }
        });
    }

    private applyApprovedCharacterNameLocally(finalizedName: string) {
        try {
            const player = this.sp.Game.getPlayer() as Actor | null;
            if (!player) {
                return;
            }

            const base = player.getBaseObject() as any;
            base?.setName?.(finalizedName);
            player?.setDisplayName?.(finalizedName, true);
        } catch (error) {
            logTrace(this, "Failed to apply approved character name locally", `${error}`);
        }
    }

    private parseHttpError(response: { status?: number; body?: string; error?: string }) {
        const raw = `${response.body || response.error || ""}`.trim();
        if (!raw) {
            return `status ${response.status}`;
        }

        try {
            const parsed = JSON.parse(raw);
            return `${parsed?.error || raw}`.trim();
        } catch {
            return raw;
        }
    }

    private flushDeferredCharacterNameReject() {
        if (!this.deferredCharacterNameRejectMessage) {
            return;
        }

        const errorText = this.deferredCharacterNameRejectMessage;
        this.deferredCharacterNameRejectMessage = "";

        this.sp.printConsole(`Character name rejected: ${errorText}`);
        this.sp.Debug.notification(`Character name rejected: ${errorText}`);
        this.sp.Debug.messageBox(`Character name rejected.\n\n${errorText}\n\nChoose a different name.`);
        this.reopenRaceMenuAfterMessageBox(this.raceMenuRetryGeneration);
    }

    private reopenRaceMenuAfterMessageBox(generation: number) {
        const reopen = () => {
            if (this.sp.Ui.isMenuOpen("MessageBoxMenu")) {
                this.controller.once("update", reopen);
                return;
            }

            if (generation !== this.raceMenuRetryGeneration || !this.mustReturnToRaceMenuAfterNameReject) {
                return;
            }

            this.nextRaceMenuRetryAt = Date.now() + 500;
            this.controller.once("update", () => {
                if (generation !== this.raceMenuRetryGeneration || !this.mustReturnToRaceMenuAfterNameReject) {
                    return;
                }

                this.consumeCharacterNameRetry();
                this.sp.Game.showRaceMenu();
            });
        };

        this.controller.once("update", reopen);
    }

    private enforceCharacterNameRetry() {
        if (!this.mustReturnToRaceMenuAfterNameReject || this.pendingCharacterNameFinalize) {
            return;
        }

        if (this.sp.Ui.isMenuOpen("RaceSex Menu") || this.sp.Ui.isMenuOpen("MessageBoxMenu")) {
            return;
        }

        const now = Date.now();
        if (now < this.nextRaceMenuRetryAt) {
            return;
        }

        this.consumeCharacterNameRetry();
        this.nextRaceMenuRetryAt = now + 750;
        this.sp.Game.showRaceMenu();
    }

    private clearCharacterNameRetry() {
        this.raceMenuRetryGeneration += 1;
        this.mustReturnToRaceMenuAfterNameReject = false;
        this.nextRaceMenuRetryAt = 0;
        this.deferredCharacterNameRejectMessage = "";
    }

    private armCharacterNameRetry() {
        this.raceMenuRetryGeneration += 1;
        this.mustReturnToRaceMenuAfterNameReject = true;
        this.nextRaceMenuRetryAt = Date.now();
    }

    private consumeCharacterNameRetry() {
        this.mustReturnToRaceMenuAfterNameReject = false;
        this.nextRaceMenuRetryAt = 0;
    }

    private sendEquipment(_refrId?: number) {
        if (_refrId) {
          return;
        }
        if (this.equipmentChanged) {
            this.equipmentChanged = false;

            ++this.numEquipmentChanges;

            const eq = getEquipment(
                this.sp.Game.getPlayer() as Actor,
                this.numEquipmentChanges,
            );
            const message: MessageWithRefrId<UpdateEquipmentMessage> = {
                t: MsgType.UpdateEquipment,
                data: eq,
                _refrId
            };

            this.controller.emitter.emit("sendMessageWithRefrId", {
                message,
                reliability: "reliable"
            });
        }
    }

    private sendHostAttempts() {
        const remoteId = nextHostAttempt();
        if (!remoteId) {
          return;
        }

        this.controller.emitter.emit("sendMessage", {
            message: {
                t: MsgType.Host,
                remoteId
            },
            reliability: "unreliable"
        });
    }

    private getInputOwner(_refrId?: number) {
        return _refrId
            ? this.sp.Actor.from(this.sp.Game.getFormEx(worldViewMisc.remoteIdToLocalId(_refrId)))
            : this.sp.Game.getPlayer();
    }

    private getForm(refrId: number | undefined, world: WorldModel): FormModel | undefined {
        const form = refrId
            ? world?.forms.find((f) => f?.refrId === refrId)
            : world.forms[world.playerCharacterFormIdx];
        return form;
    }

    private updateActorValuesAfterAnimation(animName: string) {
        if (
            animName === 'JumpLand' ||
            animName === 'JumpLandDirectional' ||
            animName === 'DeathAnim'
        ) {
            this.actorValuesNeedUpdate = true;
        }
    }

    private get singlePlayerService() {
        return this.controller.lookupListener(SinglePlayerService);
    }

    private lastSendMovementMoment = new Map<string, number>();
    private playerAnimSource = new Map<string, AnimationSource>(); // TODO: make service
    private lastAnimationSent = new Map<string, Animation>();
    private actorValuesNeedUpdate = false;
    private isRaceSexMenuShown = false;
    private equipmentChanged = false;
    private numEquipmentChanges = 0;
    private prevValues: ActorValues = { health: 0, stamina: 0, magicka: 0 };
    private prevActorValuesUpdateTime = 0;
    private prevCastingDetectedTime = 0;
    private pendingCharacterNameFinalize = false;
    private deferredCharacterNameRejectMessage = "";
    private mustReturnToRaceMenuAfterNameReject = false;
    private nextRaceMenuRetryAt = 0;
    private raceMenuRetryGeneration = 0;
}
