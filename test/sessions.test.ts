import { describe, it, expect } from "vitest";
import { deviceLabel, displayIp, isMobileAgent } from "../lib/types";

describe("session labels", () => {
  it("names browsers and platforms like the Android app", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      ),
    ).toBe("Chrome on macOS");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0",
      ),
    ).toBe("Firefox on Windows");
    expect(deviceLabel("Settlr-Android/1.2.0")).toBe("Settlr for Android");
    expect(deviceLabel("")).toBe("Unknown device");
    expect(deviceLabel(null)).toBe("Unknown device");
    expect(deviceLabel("curl/8.21.0")).toBe("curl/8.21.0");
  });

  it("drops the port from IPs", () => {
    expect(displayIp("[::1]:57184")).toBe("::1");
    expect(displayIp("10.0.0.2:443")).toBe("10.0.0.2");
    expect(displayIp("2001:db8::1")).toBe("2001:db8::1");
    expect(displayIp("")).toBe("");
  });

  it("detects phones", () => {
    expect(isMobileAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      true,
    );
    expect(isMobileAgent("Settlr-Android/1.2.0")).toBe(true);
    expect(isMobileAgent("Mozilla/5.0 (X11; Linux x86_64)")).toBe(false);
  });
});
