package dev.pixelpolo.tetrisflip.score;

/** What the leaderboard exposes: no ids, no timestamps. */
public record ScoreResponse(String name, int score, int lines, int level) {

    static ScoreResponse from(Score score) {
        return new ScoreResponse(score.name(), score.score(), score.lines(), score.level());
    }
}
