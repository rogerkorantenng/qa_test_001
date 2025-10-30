import { expect, it } from "vitest";

const UNICODE_APOSTROPHES = /[\u2018\u2019\u02BC\u2032\u2035]/g;
function normalizeName(input: string): string {
    let s = input.normalize("NFC");
    s = s.replace(UNICODE_APOSTROPHES, "'");
    s = s.replace(/\p{Separator}+/gu, " ");
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
    s = s.replace(/\s+/g, " ").trim();
    return s;
}

it("maps curly apostrophes to ASCII", () => {
    expect(normalizeName("Luc O‘Connor")).toBe("Luc O'Connor");
    expect(normalizeName("Sara O’Malley")).toBe("Sara O'Malley");
});

it("removes zero-width chars & odd spaces", () => {
    expect(normalizeName("Jo\u200Bhn   Doe")).toBe("John Doe");
});
