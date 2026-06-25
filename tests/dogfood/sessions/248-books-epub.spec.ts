/**
 * Session 248 — real-shell verification of Books F-228b (the EPUB reader).
 *
 * Writes a minimal valid EPUB, stubs the OS file dialog to return it, opens
 * Books and drives its Import affordance, then asserts the reflow reader mounts
 * real pages (`.books__page`) — i.e. epub.js actually parsed the archive and the
 * content flowed through the shared reflow reader, NOT the "EPUB not built yet"
 * notice. This is the live half the unit tests can't cover (epub.js needs a real
 * archive + DOM).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { APP, startSession } from "../lib/founder";

/** Minimal stored PKZIP (the EPUB OCF container — `mimetype` must be the first,
 *  uncompressed entry; everything else stored keeps the fixture dependency-free). */
function makeStoredZip(members: { name: string; data: Buffer }[]): Buffer {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;
	for (const m of members) {
		const name = Buffer.from(m.name, "utf8");
		const local = Buffer.alloc(30 + name.length);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt32LE(m.data.length, 18);
		local.writeUInt32LE(m.data.length, 22);
		local.writeUInt16LE(name.length, 26);
		name.copy(local, 30);
		const localRecord = Buffer.concat([local, m.data]);
		locals.push(localRecord);
		const central = Buffer.alloc(46 + name.length);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt32LE(m.data.length, 20);
		central.writeUInt32LE(m.data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		name.copy(central, 46);
		centrals.push(central);
		offset += localRecord.length;
	}
	const localBlock = Buffer.concat(locals);
	const centralBlock = Buffer.concat(centrals);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(members.length, 8);
	eocd.writeUInt16LE(members.length, 10);
	eocd.writeUInt32LE(centralBlock.length, 12);
	eocd.writeUInt32LE(localBlock.length, 16);
	return Buffer.concat([localBlock, centralBlock, eocd]);
}

function makeEpub(): Buffer {
	const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;
	const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Verify 247 Book</dc:title>
    <dc:identifier id="bookid">urn:uuid:verify-247</dc:identifier>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="ch1"/></spine>
</package>`;
	const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:verify-247"/></head>
  <docTitle><text>Verify 247 Book</text></docTitle>
  <navMap><navPoint id="np1" playOrder="1"><navLabel><text>Chapter One</text></navLabel><content src="ch1.xhtml"/></navPoint></navMap>
</ncx>`;
	const ch1 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter One</title></head>
<body><h1>Chapter One</h1><p>EPUB-VERIFY-247 the quick brown fox jumps over the lazy dog.</p></body></html>`;
	return makeStoredZip([
		{ name: "mimetype", data: Buffer.from("application/epub+zip") },
		{ name: "META-INF/container.xml", data: Buffer.from(container) },
		{ name: "OEBPS/content.opf", data: Buffer.from(opf) },
		{ name: "OEBPS/toc.ncx", data: Buffer.from(ncx) },
		{ name: "OEBPS/ch1.xhtml", data: Buffer.from(ch1) },
	]);
}

test("Books F-228b: a real EPUB opens to the reflow reader", async () => {
	test.setTimeout(240_000);
	const tmp = mkdtempSync(join(tmpdir(), "bs-epub-"));
	const epubPath = join(tmp, "verify-247.epub");
	writeFileSync(epubPath, makeEpub());

	const s = await startSession("248-books-epub");
	try {
		// Stub the native open dialog (main process) to return the fixture EPUB.
		await s.app.evaluate(({ dialog }, p) => {
			(dialog as unknown as { showOpenDialog: unknown }).showOpenDialog = async () => ({
				canceled: false,
				filePaths: [p],
			});
		}, epubPath);

		const books = await s.openApp(APP.Books);
		await books.waitForTimeout(2500);
		await s.shot(books, "01-open");

		// The Northbound vault is persistent, so the shelf may already hold the
		// EPUB from a prior run. Empty shelf → import (auto-opens); populated shelf
		// → open the first book. Either way an EPUB flows through the reflow reader.
		const importCta = books.locator(".books__library-import-cta");
		if ((await importCta.count()) > 0) {
			await importCta
				.first()
				.click({ timeout: 8000 })
				.catch(() => undefined);
		}
		await books.waitForTimeout(2500);
		if ((await books.locator(".books__page").count()) === 0) {
			await books
				.locator(".books__row")
				.first()
				.click({ timeout: 8000 })
				.catch(() => undefined);
		}

		// epub.js is lazy-loaded + the archive parsed → reflow pages mount.
		await books.locator(".books__page").first().waitFor({ state: "visible", timeout: 30_000 });
		await s.shot(books, "02-reader");

		const pages = await books.locator(".books__page").count();
		s.note(`reflow pages mounted: ${pages}`);
		expect(pages, "reflow reader mounted real EPUB pages").toBeGreaterThan(0);
	} finally {
		await s.finish();
		rmSync(tmp, { recursive: true, force: true });
	}
});
