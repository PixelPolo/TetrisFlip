package dev.pixelpolo.tetrisflip.score;

/**
 * Cheap server-side sanity checks on a submitted score. The game runs in the browser, so these cannot
 * prove a score is honest: they only reject results that the game rules make impossible.
 */
public final class ScorePlausibility {

    /** Lines per level, as in the game rules (frontend/src/game/config.ts). */
    static final int LINES_PER_LEVEL = 10;
    /** Even a perfect player cannot clear more than this many lines per second. */
    static final double MAX_LINES_PER_SECOND = 2.5;
    /** Fastest human piece rate, with a wide margin. */
    static final double MAX_PIECES_PER_SECOND = 6;
    /** Points for one piece dropped from the top of a 20 row board. */
    static final int MAX_DROP_POINTS_PER_PIECE = 40;
    /** Largest line clear value per row and level (a flip can clear more than four rows at once). */
    static final int MAX_LINE_POINTS_PER_ROW = 300;
    /** A full board holds this many pieces without a single line cleared. */
    static final int PIECES_WITHOUT_CLEARS = 60;
    static final double MIN_SECONDS = 3;

    private ScorePlausibility() {
    }

    /** Returns null when the score looks possible, otherwise a short reason. */
    public static String check(int score, int lines, int level, double elapsedSeconds) {
        if (level != lines / LINES_PER_LEVEL + 1) {
            return "level does not match the number of lines";
        }
        if (elapsedSeconds < MIN_SECONDS) {
            return "game too short";
        }
        if (lines > elapsedSeconds * MAX_LINES_PER_SECOND) {
            return "too many lines for the game duration";
        }
        double pieces = Math.min(2.5 * lines + PIECES_WITHOUT_CLEARS, elapsedSeconds * MAX_PIECES_PER_SECOND);
        double maxScore = (double) MAX_LINE_POINTS_PER_ROW * lines * level + MAX_DROP_POINTS_PER_PIECE * pieces;
        if (score > maxScore) {
            return "score too high for the lines and duration";
        }
        return null;
    }
}
