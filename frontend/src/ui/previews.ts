import { boxSize, shapeCells, type PieceType } from '../game/pieces';
import type { Theme } from '../render/themes';

const CELL = 18;

/** Draws small flat pieces for the "next" and "hold" panels. */
export function drawPieces(canvas: HTMLCanvasElement, pieces: PieceType[], theme: Theme): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pieces.forEach((type, index) => {
    ctx.fillStyle = theme.pieces[type];
    const size = boxSize(type);
    const offsetX = (canvas.width - size * CELL) / 2;
    for (const { x, y } of shapeCells(type, 0)) {
      ctx.fillRect(offsetX + x * CELL, index * 60 + 8 + y * CELL, CELL - 2, CELL - 2);
    }
  });
}
