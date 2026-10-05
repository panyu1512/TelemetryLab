import { describe, expect, it } from "vitest";

import { formatDriverName } from "./driverName";

describe("formatDriverName", () => {
  it("title-cases a name typed in caps", () => {
    expect(formatDriverName("JOHN SMITH")).toBe("John Smith");
  });

  it("title-cases a name typed in lower case", () => {
    expect(formatDriverName("john smith")).toBe("John Smith");
  });

  it("leaves an ordinary mixed-case name exactly as typed", () => {
    expect(formatDriverName("John Smith")).toBe("John Smith");
    expect(formatDriverName("Kike Ferrer")).toBe("Kike Ferrer");
  });

  it("capitalises each half of a hyphenated name", () => {
    expect(formatDriverName("JEAN-PIERRE DUPONT")).toBe("Jean-Pierre Dupont");
    expect(formatDriverName("anna-lena SCHMIDT-WEBER")).toBe("Anna-Lena Schmidt-Weber");
  });

  it("capitalises after an apostrophe, straight or curly", () => {
    expect(formatDriverName("SEAN O'BRIEN")).toBe("Sean O'Brien");
    expect(formatDriverName("sean o’brien")).toBe("Sean O’Brien");
    expect(formatDriverName("LUCA D'ANGELO")).toBe("Luca D'Angelo");
  });

  it("handles multiple given names and surnames", () => {
    expect(formatDriverName("MARIA JOSE GARCIA LOPEZ")).toBe("Maria Jose Garcia Lopez");
  });

  it("keeps deliberate interior capitals", () => {
    expect(formatDriverName("Ronald McDonald")).toBe("Ronald McDonald");
    expect(formatDriverName("Nyck DeVries")).toBe("Nyck DeVries");
  });

  it("fixes only the all-caps words of an otherwise cased name", () => {
    expect(formatDriverName("Tuan LE")).toBe("Tuan Le");
    expect(formatDriverName("Ronald MCDONALD")).toBe("Ronald McDonald");
  });

  it("keeps lower-case particles the owner typed in a cased name", () => {
    expect(formatDriverName("Max van Berg")).toBe("Max van Berg");
    expect(formatDriverName("Pedro de la ROSA")).toBe("Pedro de la Rosa");
  });

  it("never treats the first or last word as a particle", () => {
    expect(formatDriverName("max Verstappen")).toBe("Max Verstappen");
    expect(formatDriverName("Max verstappen")).toBe("Max Verstappen");
  });

  it("title-cases particles when the whole name arrives in one case", () => {
    // No evidence of intent either way; see the module's note.
    expect(formatDriverName("MAX VAN BERG")).toBe("Max Van Berg");
  });

  it("capitalises the letter after Mc, but not after Mac", () => {
    expect(formatDriverName("JAMES MCKAY")).toBe("James McKay");
    expect(formatDriverName("FELIPE MACHADO")).toBe("Felipe Machado");
  });

  it("keeps a generational suffix in caps", () => {
    expect(formatDriverName("JOHN SMITH III")).toBe("John Smith III");
    expect(formatDriverName("john smith ii")).toBe("John Smith II");
    expect(formatDriverName("John Smith Jr")).toBe("John Smith Jr");
  });

  it("does not read a first name as a numeral", () => {
    expect(formatDriverName("IV SMITH")).toBe("Iv Smith");
  });

  it("keeps initials and their stops", () => {
    expect(formatDriverName("J.J. ABRAMS")).toBe("J.J. Abrams");
    expect(formatDriverName("a. senna")).toBe("A. Senna");
  });

  it("cases accented and non-Latin letters", () => {
    expect(formatDriverName("JOSÉ ÁLVAREZ")).toBe("José Álvarez");
    expect(formatDriverName("ÅSA ÖSTERBERG")).toBe("Åsa Österberg");
    expect(formatDriverName("ΝΙΚΟΣ ΠΑΠΑΔΑΚΗΣ")).toBe("Νικος Παπαδακης");
  });

  it("collapses whitespace and trims", () => {
    expect(formatDriverName("  JOHN   SMITH  ")).toBe("John Smith");
  });

  it("returns an empty string for a missing name", () => {
    expect(formatDriverName("")).toBe("");
    expect(formatDriverName("   ")).toBe("");
    expect(formatDriverName(null)).toBe("");
    expect(formatDriverName(undefined)).toBe("");
  });

  it("leaves digits and single letters alone", () => {
    expect(formatDriverName("DRIVER 2")).toBe("Driver 2");
    expect(formatDriverName("JANE X")).toBe("Jane X");
  });
});
