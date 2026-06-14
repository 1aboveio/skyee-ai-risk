import { describe, expect, it } from "vitest";
import {
  edgeAnnotations,
  getEdgeAnnotation,
  getLocalizedEdgeAnnotation,
  getSameAttributeTypeLabel,
} from "./edge-annotations";

// @covers lib/graph/edge-annotations
// @level unit

describe("edge-annotations", () => {
  it("returns the English same-attribute type label by default", () => {
    expect(getSameAttributeTypeLabel("same_mobile_phone", "en")).toBe(
      "Same Mobile Phone"
    );
    expect(getSameAttributeTypeLabel("same_email", "en")).toBe("Same Email");
  });

  it("returns the Chinese same-attribute type label for zh-CN", () => {
    expect(getSameAttributeTypeLabel("same_mobile_phone", "zh-CN")).toBe(
      "同卡/同手机号"
    );
    expect(getSameAttributeTypeLabel("same_email", "zh-CN")).toBe("同邮箱");
  });

  it("falls back to the raw value when the label is unknown", () => {
    expect(getSameAttributeTypeLabel("unknown_type", "en")).toBe("unknown_type");
    expect(getSameAttributeTypeLabel("unknown_type", "zh-CN")).toBe(
      "unknown_type"
    );
  });

  it("returns unknown for an empty value", () => {
    expect(getSameAttributeTypeLabel("", "en")).toBe("Unknown");
    expect(getSameAttributeTypeLabel(undefined, "zh-CN")).toBe("Unknown");
  });

  it("localizes edge annotation title and description", () => {
    const annotation = edgeAnnotations.SAME_PHONE;
    expect(getLocalizedEdgeAnnotation(annotation, "en")).toEqual({
      title: annotation.title,
      description: annotation.description,
    });
    expect(getLocalizedEdgeAnnotation(annotation, "zh-CN")).toEqual({
      title: annotation.titleZh,
      description: annotation.descriptionZh,
    });
  });

  it("resolves edge annotations by edge type or same-attribute type", () => {
    expect(getEdgeAnnotation({ edgeType: "SAME_PHONE" })).toBe(
      edgeAnnotations.SAME_PHONE
    );
    expect(
      getEdgeAnnotation({ sameAttributeType: "same_mobile_phone" })
    ).toBe(edgeAnnotations.SAME_PHONE);
  });
});
