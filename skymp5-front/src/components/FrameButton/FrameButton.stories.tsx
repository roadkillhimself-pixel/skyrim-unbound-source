import { FrameButton } from './FrameButton';

export default {
  title: 'buttons/FrameButton',
  component: FrameButton,
  args: {
    name: 'frame-button',
    disabled: false,
    variant: 'DEFAULT',
    text: 'Test',
    width: 320,
    height: 60,
  },
};

export const Default = {};

export const Left = {
  args: {
    variant: 'LEFT',
  },
};

export const Right = {
  args: {
    variant: 'RIGHT',
  },
};
