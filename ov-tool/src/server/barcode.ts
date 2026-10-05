import "server-only";
import bwipjs from "bwip-js/node";

/** Code-128-Barcode als SVG (ohne Klartext – der steht im Etikett darunter). */
export function code128Svg(text: string): string {
  return bwipjs.toSVG({ bcid: "code128", text, scale: 2, height: 12, paddingwidth: 0 });
}

/** QR-Code als SVG – Handykameras (auch iPhone) öffnen damit direkt den Inventareintrag. */
export function qrSvg(text: string): string {
  return bwipjs.toSVG({ bcid: "qrcode", text, scale: 2 });
}
