import { PIECE_TYPES, type PieceType } from './pieces';

export type Random = () => number;

/** Guideline "7-bag": every piece appears once per bag of seven, in random order. */
export class BagRandomizer {
  private bag: PieceType[] = [];

  constructor(private readonly random: Random = Math.random) {}

  next(): PieceType {
    if (this.bag.length === 0) this.bag = this.shuffle([...PIECE_TYPES]);
    return this.bag.pop()!;
  }

  private shuffle(items: PieceType[]): PieceType[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }
}
