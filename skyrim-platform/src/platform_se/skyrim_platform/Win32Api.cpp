#include "Win32Api.h"
#include <shellapi.h>

Napi::Value Win32Api::LoadUrl(const Napi::CallbackInfo& info)
{
  auto str = NapiHelper::ExtractString(info[0], "url");
  const bool isHttps = str.substr(0, 8) == "https://";
  const bool isHttp = str.substr(0, 7) == "http://";
  if (!isHttps && !isHttp) {
    throw std::runtime_error(
      "Permission denied, only 'https://' and 'http://' prefixes are allowed");
  } else {
    const auto result =
      ShellExecuteA(nullptr, "open", str.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    if (reinterpret_cast<intptr_t>(result) <= 32) {
      throw std::runtime_error("Failed to open URL via ShellExecute");
    }
  }
  return info.Env().Undefined();
}

Napi::Value Win32Api::ExitProcess(const Napi::CallbackInfo& info)
{
  RE::Main::GetSingleton()->quitGame = true;
  return info.Env().Undefined();
}
