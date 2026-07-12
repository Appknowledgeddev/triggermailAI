import type { Json } from "@/lib/supabase/types";

export type EmailGlobalStyles = {
  globalBackground: string;
  globalBackgroundPattern: string;
  globalBackgroundCanvas: string;
  previewPadding: number;
  emailWidth: number;
  emailBorderRadius: number;
  emailBoxShadow: string;
  bodyTextInsetLeft: number;
  bodyTextInsetRight: number;
  bodyContentMargin: number;
  bodyTextSize: number;
  bodyTextColor: string;
};

const shellHeaderMarker = 'data-builder-shell="header"';
const shellFooterMarker = 'data-builder-shell="footer"';

const defaultGlobalStyles: EmailGlobalStyles = {
  globalBackground: "#111827",
  globalBackgroundPattern: "none",
  globalBackgroundCanvas: "plain",
  previewPadding: 20,
  emailWidth: 760,
  emailBorderRadius: 10,
  emailBoxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  bodyTextInsetLeft: 0,
  bodyTextInsetRight: 0,
  bodyContentMargin: 0,
  bodyTextSize: 15,
  bodyTextColor: "#475569",
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function getDesignRecord(design: Json | null | undefined) {
  return design && typeof design === "object" && !Array.isArray(design) ? design as Record<string, unknown> : {};
}

export function getEmailCustomHead(design: Json | null | undefined) {
  const record = getDesignRecord(design);

  return typeof record.customHead === "string" ? record.customHead : "";
}

export function getEmailGlobalStyles(design: Json | null | undefined): EmailGlobalStyles {
  const record = getDesignRecord(design);
  const globalStyles = record.globalStyles && typeof record.globalStyles === "object" && !Array.isArray(record.globalStyles)
    ? record.globalStyles as Record<string, unknown>
    : {};

  return {
    globalBackground: typeof globalStyles.globalBackground === "string" ? globalStyles.globalBackground : defaultGlobalStyles.globalBackground,
    globalBackgroundPattern: typeof globalStyles.globalBackgroundPattern === "string" ? globalStyles.globalBackgroundPattern : defaultGlobalStyles.globalBackgroundPattern,
    globalBackgroundCanvas: typeof globalStyles.globalBackgroundCanvas === "string" ? globalStyles.globalBackgroundCanvas : defaultGlobalStyles.globalBackgroundCanvas,
    previewPadding: clampNumber(globalStyles.previewPadding, defaultGlobalStyles.previewPadding, 0, 120),
    emailWidth: clampNumber(globalStyles.emailWidth, defaultGlobalStyles.emailWidth, 320, 960),
    emailBorderRadius: clampNumber(globalStyles.emailBorderRadius, defaultGlobalStyles.emailBorderRadius, 0, 40),
    emailBoxShadow: typeof globalStyles.emailBoxShadow === "string" ? globalStyles.emailBoxShadow : defaultGlobalStyles.emailBoxShadow,
    bodyTextInsetLeft: clampNumber(globalStyles.bodyTextInsetLeft, defaultGlobalStyles.bodyTextInsetLeft, 0, 160),
    bodyTextInsetRight: clampNumber(globalStyles.bodyTextInsetRight, defaultGlobalStyles.bodyTextInsetRight, 0, 160),
    bodyContentMargin: clampNumber(globalStyles.bodyContentMargin, defaultGlobalStyles.bodyContentMargin, 0, 160),
    bodyTextSize: clampNumber(globalStyles.bodyTextSize, defaultGlobalStyles.bodyTextSize, 10, 32),
    bodyTextColor: typeof globalStyles.bodyTextColor === "string" ? globalStyles.bodyTextColor : defaultGlobalStyles.bodyTextColor,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractMarkedTable(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);

  if (markerIndex === -1) {
    return { section: "", remaining: html };
  }

  const tableStart = html.lastIndexOf("<table", markerIndex);

  if (tableStart === -1) {
    return { section: "", remaining: html };
  }

  const tablePattern = /<\/?table\b[^>]*>/gi;
  tablePattern.lastIndex = tableStart;
  let depth = 0;
  let tableEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = tablePattern.exec(html)) !== null) {
    if (match[0].startsWith("</")) {
      depth -= 1;

      if (depth === 0) {
        tableEnd = match.index;
        break;
      }
    } else {
      depth += 1;
    }
  }

  if (tableEnd === -1) {
    return { section: "", remaining: html };
  }

  const endIndex = tableEnd + "</table>".length;
  const section = html.slice(tableStart, endIndex).trim();
  const remaining = `${html.slice(0, tableStart)}${html.slice(endIndex)}`.trim();

  return { section, remaining };
}

function splitEmailSections(html: string) {
  const cleanHtml = stripBuilderOnlyHtml(html);
  const headerSplit = extractMarkedTable(cleanHtml, shellHeaderMarker);
  const footerSplit = extractMarkedTable(headerSplit.remaining, shellFooterMarker);

  return {
    headerHtml: headerSplit.section,
    bodyHtml: footerSplit.remaining.trim(),
    footerHtml: footerSplit.section,
  };
}

function stripBuilderOnlyHtml(html: string) {
  return html
    .replace(/<span\b(?=[^>]*data-builder-resize-handle=["'][^"']*["'])[^>]*><\/span>/gi, "")
    .replace(/\sdata-builder-selected=(["'])[^"']*\1/gi, "")
    .replace(/\sdata-builder-hovered=(["'])[^"']*\1/gi, "")
    .replace(/\sdata-hover-remove-section=(["'])[^"']*\1/gi, "")
    .replace(/\scontenteditable=(["'])[^"']*\1/gi, "")
    .replace(/\sdraggable=(["'])[^"']*\1/gi, "");
}

function extractBodyPatternSections(html: string) {
  const sections: string[] = [];
  const footerSections: string[] = [];
  let remaining = html;

  while (remaining.includes("data-builder-hero-pattern")) {
    const markerIndex = remaining.indexOf("data-builder-hero-pattern");
    const tableStart = remaining.lastIndexOf("<table", markerIndex);
    const tableEnd = remaining.indexOf("</table>", markerIndex);

    if (tableStart === -1 || tableEnd === -1) {
      break;
    }

    const endIndex = tableEnd + "</table>".length;
    sections.push(remaining.slice(tableStart, endIndex).trim());
    remaining = `${remaining.slice(0, tableStart)}${remaining.slice(endIndex)}`.trim();
  }

  while (remaining.includes("data-builder-footer-pattern")) {
    const markerIndex = remaining.indexOf("data-builder-footer-pattern");
    const tableStart = remaining.lastIndexOf("<table", markerIndex);
    const tableEnd = remaining.indexOf("</table>", markerIndex);

    if (tableStart === -1 || tableEnd === -1) {
      break;
    }

    const endIndex = tableEnd + "</table>".length;
    footerSections.push(remaining.slice(tableStart, endIndex).trim());
    remaining = `${remaining.slice(0, tableStart)}${remaining.slice(endIndex)}`.trim();
  }

  return {
    heroPatternHtml: sections.join("\n"),
    footerPatternHtml: footerSections.join("\n"),
    bodyHtml: remaining,
  };
}

function buildEmailBackgroundStyle(styles: EmailGlobalStyles) {
  const pattern = styles.globalBackgroundPattern;
  const canvas = styles.globalBackgroundCanvas;
  const backgroundColor = getEmailCanvasColor(styles.globalBackground);
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];

  if (canvas === "paper") {
    images.push("linear-gradient(135deg, rgba(255,255,255,0.12) 0 25%, transparent 25% 50%, rgba(15,23,42,0.035) 50% 75%, transparent 75% 100%)");
    sizes.push("24px 24px");
    positions.push("0 0");
  } else if (canvas === "studio") {
    images.push("radial-gradient(circle at 18% 12%, rgba(217,70,239,0.20), transparent 30%)", "radial-gradient(circle at 82% 18%, rgba(59,130,246,0.16), transparent 28%)", "radial-gradient(circle at 50% 92%, rgba(16,185,129,0.10), transparent 30%)");
    sizes.push("100% 100%", "100% 100%", "100% 100%");
    positions.push("0 0", "0 0", "0 0");
  } else if (canvas === "blueprint") {
    images.push("linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px)", "linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)");
    sizes.push("48px 48px", "48px 48px");
    positions.push("-1px -1px", "-1px -1px");
  } else if (canvas === "mist") {
    images.push("radial-gradient(circle at 30% 20%, rgba(255,255,255,0.26), transparent 34%)", "radial-gradient(circle at 72% 72%, rgba(148,163,184,0.18), transparent 36%)");
    sizes.push("100% 100%", "100% 100%");
    positions.push("0 0", "0 0");
  } else if (canvas === "aurora") {
    images.push("linear-gradient(120deg, rgba(217,70,239,0.20), transparent 34%, rgba(34,211,238,0.16), transparent 72%, rgba(16,185,129,0.14))");
    sizes.push("100% 100%");
    positions.push("0 0");
  } else if (canvas === "linen") {
    images.push("repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 1px, transparent 1px 4px)", "repeating-linear-gradient(90deg, rgba(15,23,42,0.05) 0 1px, transparent 1px 5px)");
    sizes.push("auto", "auto");
    positions.push("0 0", "0 0");
  }

  if (pattern === "dots") {
    images.push("radial-gradient(circle, rgba(148,163,184,0.36) 1px, transparent 1.5px)");
    sizes.push("18px 18px");
    positions.push("0 0");
  } else if (pattern === "grid") {
    images.push("linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px)", "linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)");
    sizes.push("22px 22px", "22px 22px");
    positions.push("-1px -1px", "-1px -1px");
  } else if (pattern === "diagonal") {
    images.push("repeating-linear-gradient(135deg, rgba(148,163,184,0.20) 0 1px, transparent 1px 13px)");
    sizes.push("auto");
    positions.push("0 0");
  } else if (pattern === "cross") {
    images.push("repeating-linear-gradient(45deg, rgba(148,163,184,0.14) 0 1px, transparent 1px 14px)", "repeating-linear-gradient(135deg, rgba(148,163,184,0.14) 0 1px, transparent 1px 14px)");
    sizes.push("auto", "auto");
    positions.push("0 0", "0 0");
  } else if (pattern === "glow") {
    images.push("radial-gradient(circle at 50% 0%, rgba(255,255,255,0.20), transparent 34%)");
    sizes.push("100% 100%");
    positions.push("0 0");
  } else if (pattern === "waves") {
    images.push("radial-gradient(ellipse at top, transparent 52%, rgba(148,163,184,0.18) 53%, transparent 56%)");
    sizes.push("38px 24px");
    positions.push("0 0");
  } else if (pattern === "checker") {
    images.push("linear-gradient(45deg, rgba(148,163,184,0.16) 25%, transparent 25% 75%, rgba(148,163,184,0.16) 75%)", "linear-gradient(45deg, rgba(148,163,184,0.16) 25%, transparent 25% 75%, rgba(148,163,184,0.16) 75%)");
    sizes.push("24px 24px", "24px 24px");
    positions.push("0 0", "12px 12px");
  } else if (pattern === "rings") {
    images.push("radial-gradient(circle, transparent 0 7px, rgba(148,163,184,0.22) 8px, transparent 9px)");
    sizes.push("34px 34px");
    positions.push("0 0");
  } else if (pattern === "plus") {
    images.push("linear-gradient(rgba(148,163,184,0.22) 2px, transparent 2px)", "linear-gradient(90deg, rgba(148,163,184,0.22) 2px, transparent 2px)");
    sizes.push("28px 28px", "28px 28px");
    positions.push("13px 13px", "13px 13px");
  }

  return [
    `background-color:${backgroundColor}`,
    images.length ? `background-image:${images.join(",")}` : "",
    sizes.length ? `background-size:${sizes.join(",")}` : "",
    positions.length ? `background-position:${positions.join(",")}` : "",
  ].filter(Boolean).join(";");
}

function getEmailCanvasColor(backgroundColor: string) {
  const normalizedColor = backgroundColor.trim().toLowerCase();

  if (!normalizedColor || normalizedColor === "transparent" || normalizedColor === "#fff" || normalizedColor === "#ffffff" || normalizedColor === "white") {
    return "#f3f4fb";
  }

  return backgroundColor;
}

function setInlineStyleValue(style: string, property: string, value: string) {
  const declaration = `${property}:${value}`;
  const propertyPattern = new RegExp(`${property}\\s*:\\s*[^;]+`, "i");

  if (propertyPattern.test(style)) {
    return style.replace(propertyPattern, declaration);
  }

  return `${style.trim().replace(/;$/, "")};${declaration}`.replace(/^;/, "");
}

function applyBodyTextStylesHtml(html: string, left: number, right: number, textSize: number, textColor: string) {
  const hasInset = left > 0 || right > 0;
  const hasTextSize = textSize > 0;
  const hasTextColor = Boolean(textColor);

  if (!hasInset && !hasTextSize && !hasTextColor) {
    return html;
  }

  return html.replace(/<(p|li|blockquote|td|div|span)\b([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const styleMatch = attrs.match(/\sstyle=(["'])(.*?)\1/i);
    const supportsTextInset = /^(p|li|blockquote)$/i.test(tag);
    const insetStyle = [
      supportsTextInset ? "box-sizing:border-box" : "",
      supportsTextInset && left > 0 ? `padding-left:${left}px` : "",
      supportsTextInset && right > 0 ? `padding-right:${right}px` : "",
      hasTextSize ? `font-size:${textSize}px` : "",
      hasTextColor ? `color:${textColor}` : "",
    ].filter(Boolean).join(";");

    if (styleMatch) {
      let nextStyle = styleMatch[2];

      if (supportsTextInset) {
        nextStyle = setInlineStyleValue(nextStyle, "box-sizing", "border-box");
      }
      if (supportsTextInset && left > 0) {
        nextStyle = setInlineStyleValue(nextStyle, "padding-left", `${left}px`);
      }
      if (supportsTextInset && right > 0) {
        nextStyle = setInlineStyleValue(nextStyle, "padding-right", `${right}px`);
      }

      if (hasTextSize && !/font-size\s*:/i.test(nextStyle)) {
        nextStyle = setInlineStyleValue(nextStyle, "font-size", `${textSize}px`);
      }
      if (hasTextColor && !/color\s*:/i.test(nextStyle)) {
        nextStyle = setInlineStyleValue(nextStyle, "color", textColor);
      }

      return `<${tag}${attrs.replace(styleMatch[0], ` style=${styleMatch[1]}${nextStyle}${styleMatch[1]}`)}>`;
    }

    return `<${tag}${attrs} style="${insetStyle}">`;
  });
}

function parseShadowFallback(value: string) {
  if (!value || value === "none") {
    return null;
  }

  const rgbaMatch = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?\s*\)/i);
  const shadowWithoutColor = value.replace(/rgba?\([^)]+\)/gi, "");
  const lengths = Array.from(shadowWithoutColor.matchAll(/(-?\d+(?:\.\d+)?)(?:px)?/g)).map((match) => Number(match[1]));
  const vertical = Math.abs(lengths[1] || 12);
  const blur = Math.abs(lengths[2] || 32);
  const spread = Math.max(0, Math.abs(lengths[3] || 0));
  const opacity = Math.min(0.22, Math.max(0.08, rgbaMatch?.[4] === undefined ? 0.14 : Number(rgbaMatch[4]) * 0.55));
  const red = rgbaMatch?.[1] || "15";
  const green = rgbaMatch?.[2] || "23";
  const blue = rgbaMatch?.[3] || "42";
  const sideOpacity = Math.max(0.025, opacity * 0.28);
  const bottomOpacity = Math.max(0.06, opacity * 0.72);
  const farBottomOpacity = Math.max(0.025, opacity * 0.28);

  return {
    side: Math.min(18, Math.max(8, Math.round((blur + spread) / 7))),
    sideColor: `rgba(${red}, ${green}, ${blue}, ${sideOpacity.toFixed(3)})`,
    haloColor: `rgba(${red}, ${green}, ${blue}, ${Math.max(sideOpacity, bottomOpacity * 0.36, farBottomOpacity).toFixed(3)})`,
  };
}

function buildBodyDecorationStyle(hasHeroPattern: boolean, hasFooterPattern: boolean) {
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];

  if (hasHeroPattern) {
    images.push(
      "linear-gradient(180deg,rgba(243,232,255,0.72) 0%,rgba(255,255,255,0.86) 54%,rgba(255,255,255,0) 100%)",
      "radial-gradient(ellipse at 18% 4%,rgba(217,70,239,0.12),rgba(255,255,255,0) 36%)",
      "radial-gradient(ellipse at 86% 0%,rgba(56,189,248,0.10),rgba(255,255,255,0) 34%)",
    );
    sizes.push("100% 180px", "55% 190px", "55% 180px");
    positions.push("top center", "top left", "top right");
  }

  if (hasFooterPattern) {
    images.push(
      "linear-gradient(0deg,rgba(243,232,255,0.68) 0%,rgba(255,255,255,0.84) 48%,rgba(255,255,255,0) 100%)",
      "radial-gradient(ellipse at 14% 100%,rgba(124,58,237,0.10),rgba(255,255,255,0) 34%)",
      "radial-gradient(ellipse at 86% 100%,rgba(14,165,233,0.09),rgba(255,255,255,0) 32%)",
    );
    sizes.push("100% 160px", "56% 160px", "56% 160px");
    positions.push("bottom center", "bottom left", "bottom right");
  }

  if (images.length === 0) {
    return "";
  }

  return [
    `background-image:${images.join(",")}`,
    "background-repeat:no-repeat",
    `background-size:${sizes.join(",")}`,
    `background-position:${positions.join(",")}`,
  ].join(";");
}

export function buildSendableTemplateHtml(input: {
  html: string;
  preheader?: string;
  customHead?: string;
  globalStyles?: Partial<EmailGlobalStyles>;
}) {
  const styles = { ...defaultGlobalStyles, ...input.globalStyles };
  const padding = Math.max(0, Math.round(styles.previewPadding));
  const radius = Math.max(0, Math.round(styles.emailBorderRadius));
  const width = Math.max(320, Math.round(styles.emailWidth));
  const bodyMinHeight = 520;
  const canvasColor = getEmailCanvasColor(styles.globalBackground);
  const { headerHtml, bodyHtml, footerHtml } = splitEmailSections(input.html);
  const bodyLayers = extractBodyPatternSections(bodyHtml);
  const bodyHtmlWithTextStyles = applyBodyTextStylesHtml(
    bodyLayers.bodyHtml,
    Math.max(0, Math.round(styles.bodyTextInsetLeft)),
    Math.max(0, Math.round(styles.bodyTextInsetRight)),
    Math.max(0, Math.round(styles.bodyTextSize)),
    styles.bodyTextColor,
  );
  const bodyContentMargin = Math.max(0, Math.round(styles.bodyContentMargin));
  const shellWidth = width;
  const shellStyle = [
    `width:${shellWidth}px`,
    "max-width:100%",
    "background:transparent",
  ].filter(Boolean).join(";");
  const shellCellStyle = [
    "padding:0",
  ].filter(Boolean).join(";");
  const bodyDecorationStyle = buildBodyDecorationStyle(Boolean(bodyLayers.heroPatternHtml), Boolean(bodyLayers.footerPatternHtml));
  const shadowFallback = parseShadowFallback(styles.emailBoxShadow);
  const cardBorderColor = "#d8b4fe";
  const cardHaloColor = "#f0e7ff";
  const cardOuterStyle = [
    `width:${width}px`,
    `max-width:${width}px`,
    `background:${cardHaloColor}`,
    `border-radius:${radius + 1}px`,
    shadowFallback ? `padding:${Math.min(8, shadowFallback.side)}px` : "padding:1px",
  ].filter(Boolean).join(";");
  const hiddenPreheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>`
    : "";
  const cardStyle = [
    "width:100%",
    `max-width:${width}px`,
    "background:#ffffff",
    `border-radius:${radius}px`,
    "overflow:hidden",
    "position:relative",
    "font-family:Arial,sans-serif",
    "color:#111827",
    `border:1px solid ${cardBorderColor}`,
    bodyDecorationStyle,
    styles.emailBoxShadow && styles.emailBoxShadow !== "none" ? `box-shadow:${styles.emailBoxShadow}` : "",
  ].filter(Boolean).join(";");
  const hasBodyContent = bodyHtmlWithTextStyles.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, "").trim().length > 0 || /<(img|table|video|hr|br|svg|a)\b/i.test(bodyHtmlWithTextStyles);
  const bodyCellPadding = hasBodyContent && bodyContentMargin > 0 ? bodyContentMargin : 0;
  const bodyCellContent = hasBodyContent
    ? bodyHtmlWithTextStyles
    : `<table role="presentation" width="100%" height="${bodyMinHeight}" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;height:${bodyMinHeight}px;background:#ffffff;"><tr><td height="${bodyMinHeight}" bgcolor="#ffffff" style="height:${bodyMinHeight}px;background:#ffffff;font-size:1px;line-height:1px;mso-line-height-rule:exactly;">&nbsp;</td></tr></table>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin:0; padding:0; }
      img { max-width:100%; height:auto; }
      table { border-collapse:separate; }
    </style>
    ${input.customHead || ""}
  </head>
  <body bgcolor="${canvasColor}" style="margin:0;padding:0;background-color:${canvasColor};${buildEmailBackgroundStyle(styles)}">
    ${hiddenPreheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${canvasColor}" style="background-color:${canvasColor};${buildEmailBackgroundStyle(styles)}">
      <tr>
        <td align="center" bgcolor="${canvasColor}" style="padding:${padding}px;background-color:${canvasColor};">
          ${headerHtml}
          <table role="presentation" width="${shellWidth}" cellspacing="0" cellpadding="0" border="0" style="${shellStyle}">
            <tr>
              <td align="center" style="${shellCellStyle}">
                <table role="presentation" width="${width}" cellspacing="0" cellpadding="0" border="0" bgcolor="${cardHaloColor}" style="${cardOuterStyle}">
                  <tr>
                    <td align="center" style="padding:0;">
                      <table role="presentation" width="100%" height="${bodyMinHeight}" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="${cardStyle}">
                        <tr>
                          <td height="${bodyMinHeight}" bgcolor="#ffffff" style="padding:${bodyCellPadding}px;overflow:hidden;height:${bodyMinHeight}px;vertical-align:top;background:#ffffff;">
                            ${bodyCellContent}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${footerHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
