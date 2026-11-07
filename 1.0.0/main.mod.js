import { PolyMod } from "https://cdn.polymodloader.com/cb/PolyTrackMods/PolyModLoader/<0.6.3>/PolyTypes.js";

class YourModClass extends PolyMod {}

export let polyMod = new YourModClass();

console.log("[Libram] Bit-Optimized Mod Loaded");

if (window.pml) {
    window.pml.on("gameInit", (gameInstance) => {
        console.log("[Libram] Game initialized!", gameInstance);
        initLibramLZMod();
    });
}

function initLibramLZMod() {
    if (window.__libramLoaded) return;
    window.__libramLoaded = true;

    // High-Density Base62 & Bit-Packing Engine
    const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const B62_MAP = new Map([...BASE62].map((c, i) => [c, i]));

    function compressPolyTrack(str) {
        if (!str) return "";
        
        let cleaned = str.trim();
        let isPolyTrack = cleaned.startsWith("PolyTrack");
        let header = "";

        if (isPolyTrack) {
            const idx = cleaned.indexOf(":");
            if (idx !== -1) {
                header = cleaned.substring(0, idx + 1);
                cleaned = cleaned.substring(idx + 1);
            }
        }

        // Convert Base62 characters directly to 6-bit values
        let values = [];
        for (let i = 0; i < cleaned.length; i++) {
            let val = B62_MAP.get(cleaned[i]);
            if (val !== undefined) {
                values.push(val);
            } else {
                // If it contains non-Base62 characters, fallback to original
                return "RAW:" + str;
            }
        }

        // Run-Length Byte Stream Compression
        let packed = [];
        for (let i = 0; i < values.length; i++) {
            let run = 1;
            while (i + 1 < values.length && values[i] === values[i + 1] && run < 63) {
                run++;
                i++;
            }
            if (run > 2) {
                packed.push(62); // Escape character for run-length
                packed.push(run);
                packed.push(values[i]);
            } else {
                for (let r = 0; r < run; r++) {
                    packed.push(values[i]);
                }
            }
        }

        // Pack 6-bit integers into high-density string characters
        let result = "";
        for (let i = 0; i < packed.length; i += 2) {
            let v1 = packed[i];
            let v2 = (i + 1 < packed.length) ? packed[i + 1] : 63;
            let combined = (v1 << 6) | v2;
            result += String.fromCharCode(combined + 35); // Offset to safe printable range
        }

        return "LZ:" + (header ? header : "") + result;
    }

    function decompressPolyTrack(str) {
        if (!str) return "";
        let cleaned = str.trim().replace(/^['"]|['"]$/g, '');

        if (cleaned.startsWith("RAW:")) {
            return cleaned.substring(4);
        }

        if (cleaned.startsWith("LZ:")) {
            cleaned = cleaned.substring(3);
        }

        let header = "";
        if (cleaned.startsWith("PolyTrack")) {
            const idx = cleaned.indexOf(":");
            if (idx !== -1) {
                header = cleaned.substring(0, idx + 1);
                cleaned = cleaned.substring(idx + 1);
            }
        }

        // Unpack 6-bit values from UTF characters
        let packed = [];
        for (let i = 0; i < cleaned.length; i++) {
            let combined = cleaned.charCodeAt(i) - 35;
            let v1 = (combined >> 6) & 63;
            let v2 = combined & 63;
            packed.push(v1);
            if (v2 !== 63) packed.push(v2);
        }

        // Expand Run-Length Encoding
        let values = [];
        for (let i = 0; i < packed.length; i++) {
            if (packed[i] === 62 && i + 2 < packed.length) {
                let run = packed[i + 1];
                let val = packed[i + 2];
                for (let r = 0; r < run; r++) {
                    values.push(val);
                }
                i += 2;
            } else {
                values.push(packed[i]);
            }
        }

        // Rebuild original Base62 PolyTrack string
        let result = "";
        for (let i = 0; i < values.length; i++) {
            if (values[i] < 62) {
                result += BASE62[values[i]];
            }
        }

        return header + result;
    }

    function showExportModal() {
        if (document.getElementById("libram-export-modal")) return;

        const modal = document.createElement("div");
        modal.id = "libram-export-modal";
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); display: flex; align-items: center;
            justify-content: center; z-index: 2147483647; font-family: system-ui, sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: #1e1e2e; padding: 24px; border-radius: 12px; width: 420px; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0;">Export Short LZ Code</h3>
                <p style="font-size: 13px; color: #a6adc8; margin-bottom: 8px;">Paste PolyTrack code below to compress:</p>
                <textarea id="libram-raw-input" rows="4" placeholder="Paste standard track code here..." style="width: 100%; box-sizing: border-box; border-radius: 6px; padding: 10px; background: #11111b; color: #fff; border: 1px solid #45475a;"></textarea>
                
                <div id="libram-out-container" style="display: none; margin-top: 12px;">
                    <p style="font-size: 13px; color: #a6e3a1; margin-bottom: 6px;">Compressed Short Code:</p>
                    <textarea id="libram-lz-out" rows="3" readonly style="width: 100%; box-sizing: border-box; border-radius: 6px; padding: 10px; background: #11111b; color: #a6e3a1; border: 1px solid #45475a;"></textarea>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                    <button id="libram-exp-cancel" style="padding: 8px 16px; border: none; border-radius: 6px; background: #313244; color: #fff; cursor: pointer;">Close</button>
                    <button id="libram-exp-action" style="padding: 8px 16px; border: none; border-radius: 6px; background: #a6e3a1; color: #11111b; font-weight: bold; cursor: pointer;">Compress</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const rawInput = document.getElementById("libram-raw-input");
        const outContainer = document.getElementById("libram-out-container");
        const lzOut = document.getElementById("libram-lz-out");
        const actionBtn = document.getElementById("libram-exp-action");

        document.getElementById("libram-exp-cancel").onclick = () => modal.remove();

        actionBtn.onclick = () => {
            const raw = rawInput.value.trim();
            if (!raw) return;

            const compressed = compressPolyTrack(raw);
            lzOut.value = compressed;
            outContainer.style.display = "block";
            lzOut.select();

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(compressed).then(() => {
                    actionBtn.innerText = "✓ Copied!";
                }).catch(() => {
                    actionBtn.innerText = "Selected (Press Ctrl+C)";
                });
            } else {
                actionBtn.innerText = "Selected (Press Ctrl+C)";
            }
        };
    }

    function showImportModal() {
        if (document.getElementById("libram-import-modal")) return;

        const modal = document.createElement("div");
        modal.id = "libram-import-modal";
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); display: flex; align-items: center;
            justify-content: center; z-index: 2147483647; font-family: system-ui, sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: #1e1e2e; padding: 24px; border-radius: 12px; width: 420px; color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
                <h3 style="margin-top: 0;">Import Short Track Code</h3>
                <p style="font-size: 13px; color: #a6adc8; margin-bottom: 8px;">Paste LZ: track code below to decompress:</p>
                <textarea id="libram-imp-raw-input" rows="4" placeholder="Paste track code here..." style="width: 100%; box-sizing: border-box; border-radius: 6px; padding: 10px; background: #11111b; color: #fff; border: 1px solid #45475a;"></textarea>
                
                <div id="libram-imp-out-container" style="display: none; margin-top: 12px;">
                    <p style="font-size: 13px; color: #a6e3a1; margin-bottom: 6px;">Standard Track Code (Ready for PolyTrack):</p>
                    <textarea id="libram-imp-lz-out" rows="3" readonly style="width: 100%; box-sizing: border-box; border-radius: 6px; padding: 10px; background: #11111b; color: #a6e3a1; border: 1px solid #45475a;"></textarea>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 15px;">
                    <button id="libram-imp-cancel" style="padding: 8px 16px; border: none; border-radius: 6px; background: #313244; color: #fff; cursor: pointer;">Close</button>
                    <button id="libram-imp-action" style="padding: 8px 16px; border: none; border-radius: 6px; background: #a6e3a1; color: #11111b; font-weight: bold; cursor: pointer;">Decompress</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const rawInput = document.getElementById("libram-imp-raw-input");
        const outContainer = document.getElementById("libram-imp-out-container");
        const lzOut = document.getElementById("libram-imp-lz-out");
        const actionBtn = document.getElementById("libram-imp-action");

        document.getElementById("libram-imp-cancel").onclick = () => modal.remove();

        actionBtn.onclick = () => {
            const raw = rawInput.value.trim();
            if (!raw) return;

            const decompressed = decompressPolyTrack(raw);
            lzOut.value = decompressed;
            outContainer.style.display = "block";
            lzOut.select();

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(decompressed).then(() => {
                    actionBtn.innerText = "✓ Copied!";
                }).catch(() => {
                    actionBtn.innerText = "Selected (Press Ctrl+C)";
                });
            } else {
                actionBtn.innerText = "Selected (Press Ctrl+C)";
            }
        };
    }

    function buildToolbarOnce() {
        const orphanSelectors = [
            "#libram-toolbar",
            "#libram-export-btn",
            "#libram-import-float-btn",
            "#libram-context-export-btn",
            "#libram-tb-export",
            "#libram-tb-import",
            "#libram-disptext"
        ];
        orphanSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });

        const container = document.createElement("div");
        container.id = "libram-toolbar";
        container.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 2147483640 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            align-items: flex-end !important;
            font-family: system-ui, sans-serif !important;
        `;

        const badgeText = document.createElement("div");
        badgeText.innerText = "LibramLZ";
        badgeText.id = "libram-disptext";
        badgeText.style.cssText = `
            background: #1e1e2e !important;
            color: #a6e3a1 !important;
            border: 1px solid #45475a !important;
            border-radius: 6px !important;
            padding: 4px 10px !important;
            font-size: 12px !important;
            font-weight: bold !important;
            text-align: center !important;
        `;

        const exportBtn = document.createElement("button");
        exportBtn.innerText = "Export LZ";
        exportBtn.style.cssText = `
            padding: 10px 16px !important;
            background: #a6e3a1 !important;
            color: #11111b !important;
            border: 2px solid #ffffff !important;
            border-radius: 8px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
            font-size: 14px !important;
            width: 120px !important;
        `;

        const importBtn = document.createElement("button");
        importBtn.innerText = "Import LZ";
        importBtn.style.cssText = `
            padding: 10px 16px !important;
            background: #a6e3a1 !important;
            color: #11111b !important;
            border: 2px solid #ffffff !important;
            border-radius: 8px !important;
            font-weight: bold !important;
            cursor: pointer !important;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
            font-size: 14px !important;
            width: 120px !important;
        `;

        exportBtn.onclick = (e) => {
            e.stopPropagation();
            showExportModal();
        };

        importBtn.onclick = (e) => {
            e.stopPropagation();
            showImportModal();
        };

        container.appendChild(badgeText);
        container.appendChild(exportBtn);
        container.appendChild(importBtn);

        document.body.appendChild(container);
    }

    buildToolbarOnce();

    window.Libram = {
        encode: compressPolyTrack,
        decode: decompressPolyTrack
    };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLibramLZMod);
} else {
    initLibramLZMod();
}