import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider, useLocale } from "./locale-provider";

// @covers lib/i18n/locale-provider
// @level unit

function LocaleConsumer() {
  const { locale } = useLocale();
  return <span data-locale="true">{locale}</span>;
}

describe("LocaleProvider", () => {
  it("initializes from the server-resolved locale prop", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider initialLocale="en">
        <LocaleConsumer />
      </LocaleProvider>
    );

    expect(html).toContain('data-locale="true"');
    expect(html).toContain(">en<");
  });

  it("can be initialized with zh-CN", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider initialLocale="zh-CN">
        <LocaleConsumer />
      </LocaleProvider>
    );

    expect(html).toContain(">zh-CN<");
  });
});
