/**
 * Home screen category map — single source of truth for the "which TMDB
 * query feeds which row" mapping. Every row's genre / keyword / origin-country
 * filter lives on its underlying `tmdb.*` fetcher in lib/tmdb.ts; this file
 * only records *which* fetcher and *which* row-renderer each category uses,
 * in the exact display order requested.
 *
 * kind:
 *  - "movieRow"  → generic MovieRow with a tmdbFetcher (poster-path filtered)
 *  - "top10"     → Top10Row (ranked 1-10, poster-path filtered)
 *  - "special"   → a dedicated, non-TMDB-generic component (see index.tsx)
 */
import { tmdb, type TMDBPage } from "@/lib/tmdb";

export type HomeCategory =
  | {
      kind: "movieRow";
      title: string;
      fetcher: (page: number) => Promise<TMDBPage>;
      mediaType: "movie" | "tv";
    }
  | {
      kind: "top10";
      title: string;
      fetcher: (page: number) => Promise<TMDBPage>;
      mediaType: "movie" | "tv";
    }
  | {
      kind: "special";
      key:
        | "trendingNow"
        | "myList";
      title: string;
    };

// NOTE on the two ambiguous entries in the original 55-item list (no reply
// received when flagged): "Get In on the Action" was listed twice (identical
// text) — kept once, at its first position. The stray "37. Top 10 Movie
// India" entry duplicated the existing India Top 10 rows, so it is omitted
// rather than rendering a near-identical row back to back.
export const HOME_CATEGORIES: HomeCategory[] = [
  { kind: "movieRow", title: "Trending Now", fetcher: tmdb.trendingMoviesDay, mediaType: "movie" },
  { kind: "movieRow", title: "Meet Your Next Binge", fetcher: tmdb.meetNextBinge, mediaType: "tv" },
  { kind: "movieRow", title: "Your Next Watch", fetcher: tmdb.yourNextWatch, mediaType: "tv" },
  { kind: "movieRow", title: "Romantic Shows", fetcher: tmdb.romanticShows, mediaType: "tv" },
  { kind: "top10", title: "Top 10 Movies in India Today", fetcher: tmdb.top10MoviesIndia, mediaType: "movie" },
  { kind: "movieRow", title: "We Think You'll Love These", fetcher: tmdb.weThinkYoullLove, mediaType: "tv" },
  { kind: "movieRow", title: "Romantic East Asian TV Shows", fetcher: tmdb.romanticEastAsian, mediaType: "tv" },
  { kind: "movieRow", title: "Get in on the action", fetcher: tmdb.getInOnAction, mediaType: "tv" },
  { kind: "movieRow", title: "New Releases", fetcher: tmdb.nowPlaying, mediaType: "movie" },
  { kind: "movieRow", title: "First Love Romance", fetcher: tmdb.firstLoveRomance, mediaType: "tv" },
  { kind: "movieRow", title: "K-Dramas", fetcher: tmdb.koreanDramas, mediaType: "tv" },
  { kind: "movieRow", title: "Emotional Movie", fetcher: tmdb.emotionalMovies, mediaType: "movie" },
  { kind: "movieRow", title: "Eye Candy", fetcher: tmdb.eyeCandyMovies, mediaType: "movie" },
  { kind: "movieRow", title: "US TV Shows", fetcher: tmdb.usTVShows, mediaType: "tv" },
  { kind: "movieRow", title: "Critically Acclaimed TV Shows", fetcher: tmdb.awardWinningTV, mediaType: "tv" },
  { kind: "movieRow", title: "Love language", fetcher: tmdb.romanticInternational, mediaType: "tv" },
  { kind: "special", key: "myList", title: "My List" },
  { kind: "movieRow", title: "Downloads For You", fetcher: tmdb.hindiTopRated, mediaType: "movie" },
  { kind: "movieRow", title: "Can this love be translated", fetcher: tmdb.canThisLoveBeTranslated, mediaType: "tv" },
  { kind: "movieRow", title: "Fantasy TV Shows", fetcher: tmdb.scifiFantasyTV, mediaType: "tv" },
  { kind: "movieRow", title: "Made in India", fetcher: tmdb.madeInIndia, mediaType: "tv" },
  { kind: "top10", title: "Top 10 Shows in India Today", fetcher: tmdb.top10TrendingShowsIndia, mediaType: "tv" },
  { kind: "movieRow", title: "Hidden Gems", fetcher: tmdb.hiddenGems, mediaType: "movie" },
  { kind: "movieRow", title: "Romantic International Opposites-Attract TV Dramas", fetcher: tmdb.oppositesAttract, mediaType: "tv" },
  { kind: "movieRow", title: "Mysteries Dramas", fetcher: tmdb.koreanThrillers, mediaType: "tv" },
  { kind: "movieRow", title: "US TV Comedies", fetcher: tmdb.usTVComedies, mediaType: "tv" },
  { kind: "movieRow", title: "Popular on Stream", fetcher: tmdb.popularOnStream, mediaType: "movie" },
  { kind: "movieRow", title: "Suspenseful TV Shows", fetcher: tmdb.suspensefulTV, mediaType: "tv" },
  { kind: "movieRow", title: "Korean TV Dramas", fetcher: tmdb.popularKoreanTV, mediaType: "tv" },
  { kind: "movieRow", title: "Romantic International TV Comedies", fetcher: tmdb.romanticIntlComedies, mediaType: "tv" },
  { kind: "movieRow", title: "Mind-Bending Stories", fetcher: tmdb.mindBendingStories, mediaType: "movie" },
  { kind: "movieRow", title: "Familiar Favourite Series", fetcher: tmdb.familiarFavourites, mediaType: "tv" },
  { kind: "movieRow", title: "Asian Movies & TV", fetcher: tmdb.asianMovieTV, mediaType: "tv" },
  { kind: "movieRow", title: "J-Dramas", fetcher: tmdb.japaneseTVShows, mediaType: "tv" },
  { kind: "movieRow", title: "Psychological Thrillers", fetcher: tmdb.psychologicalThrillers, mediaType: "movie" },
  { kind: "movieRow", title: "Anime", fetcher: tmdb.animeTrending, mediaType: "tv" },
  { kind: "movieRow", title: "Bingeworthy TV Shows", fetcher: tmdb.bingeworthyTV, mediaType: "tv" },
  { kind: "movieRow", title: "Critically Acclaimed US TV Dramas", fetcher: tmdb.criticallyAcclaimedUSDramas, mediaType: "tv" },
  { kind: "movieRow", title: "Coming of Age", fetcher: tmdb.youngAdult, mediaType: "movie" },
  { kind: "movieRow", title: "Everyone's Watching", fetcher: tmdb.everyonesWatching, mediaType: "movie" },
  { kind: "movieRow", title: "Movies & TV Shows Dubbed in Telugu", fetcher: tmdb.teluguContent, mediaType: "tv" },
  { kind: "movieRow", title: "Global Top Picks", fetcher: tmdb.globalTopPicks, mediaType: "movie" },
  { kind: "movieRow", title: "Erase My Memory So I Can Watch Again", fetcher: tmdb.eraseMyMemory, mediaType: "tv" },
  { kind: "movieRow", title: "Swoonworthy Romance", fetcher: tmdb.swoonworthyRomance, mediaType: "tv" },
  { kind: "movieRow", title: "TV Sci-Fi & Horror", fetcher: tmdb.sciFiHorrorTV, mediaType: "tv" },
  { kind: "movieRow", title: "Crowd Pleasers", fetcher: tmdb.crowdPleasers, mediaType: "tv" },
  { kind: "movieRow", title: "Kids & Family", fetcher: tmdb.kidsFamily, mediaType: "movie" },
  // "Get In on the Action" (#50) and "37. Top 10 Movie India" (#51) omitted — duplicates, see note above.
  { kind: "movieRow", title: "Blockbuster Movies", fetcher: tmdb.blockbusters, mediaType: "movie" },
  { kind: "movieRow", title: "Late Night Watch", fetcher: tmdb.lateNightWatch, mediaType: "movie" },
  { kind: "movieRow", title: "IMDb Top Rated", fetcher: tmdb.imdbTopRated, mediaType: "movie" },
  { kind: "movieRow", title: "Leaving Soon", fetcher: tmdb.leavingSoon, mediaType: "movie" },
];
