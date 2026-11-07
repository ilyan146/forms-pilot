import { describe, expect, it } from "vitest";

import { extractionInputs, prepareFile } from "./images";

describe("document uploads", () => {
  it("accepts PDFs and Excel with missing browser MIME types", async () => {
    const pdf = await prepareFile(new File(["pdf bytes"], "Invoice.PDF"));
    const excel = await prepareFile(new File(["xlsx bytes"], "Vehicles.xlsx"));
    expect(pdf.media_type).toBe("application/pdf");
    expect(excel.media_type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(atob(pdf.data)).toBe("pdf bytes");
    expect(pdf.previewUrl).toBeUndefined();
    const inputs = extractionInputs([pdf, excel, {
      id: "image", name: "photo.jpg", media_type: "image/jpeg", data: "aGVsbG8=",
    }]);
    expect(inputs.documents.map((document) => document.name)).toEqual(["Invoice.PDF", "Vehicles.xlsx"]);
    expect(inputs.images).toEqual([{ media_type: "image/jpeg", data: "aGVsbG8=" }]);
  });

  it("rejects unsupported files and oversized documents", async () => {
    await expect(prepareFile(new File(["old workbook"], "Vehicles.xls"))).rejects.toThrow("not supported");
    await expect(prepareFile(new File([new Uint8Array(10_000_001)], "large.pdf"))).rejects.toThrow("10 MB");
  });
});
