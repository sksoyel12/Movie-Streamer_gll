/**
 * Home screen category map — single source of truth for the "which TMDB
 * query feeds which row" mapping, including imageMode per row.
 *
 * imageMode:
 *  "poster"   → tall portrait 2:3 card (default — great for romance, drama, K-drama)
 *  "backdrop" → landscape crop (great for action, thriller, sci-fi, blockbusters)
 *
 * ALL 61 categories are permanently set here in the exact display order.
 */
import { tmdb, type TMDBPage } from "@/lib/tmdb";
import type { ImageMode } from "@/components/MovieRow";

export type HomeCategory =
  | {
      kind:      "movieRow";
      title:     string;
      fetcher:   (page: number) => Promise<TMDBPage>;
      mediaType: "movie" | "tv";
      imageMode: ImageMode;
    }
  | {
      kind:      "top10";
      title:     string;
      fetcher:   (page: number) => Promise<TMDBPage>;
      mediaType: "movie" | "tv";
    }
  | {
      kind: "special";
      key:  "continueWatching" | "myList" | "topPicksForYou";
      title: string;
    };

// ─── 61 permanent rows ─────────────────────────────────────────────────────────
export const HOME_CATEGORIES: HomeCategory[] = [
  // 1  — Trending: cinematic wide shots → backdrop
  { kind: "movieRow", title: "Trending Now",                                       fetcher: tmdb.trendingMoviesDay,              mediaType: "movie", imageMode: "backdrop" },
  // 2
  { kind: "movieRow", title: "Meet Your Next Binge",                               fetcher: tmdb.meetNextBinge,                  mediaType: "tv",    imageMode: "poster"   },
  // 3
  { kind: "movieRow", title: "Your Next Watch",                                    fetcher: tmdb.yourNextWatch,                  mediaType: "tv",    imageMode: "poster"   },
  // 4  — K-drama portrait posters are iconic
  { kind: "movieRow", title: "Korean TV Shows",                                    fetcher: tmdb.koreanDramasIN,                 mediaType: "tv",    imageMode: "poster"   },
  // 5
  { kind: "movieRow", title: "Romantic Shows",                                     fetcher: tmdb.romanticShows,                  mediaType: "tv",    imageMode: "poster"   },
  // 6
  { kind: "top10",    title: "Top 10 Movies in India Today",                       fetcher: tmdb.top10MoviesIndia,               mediaType: "movie"                        },
  // 7
  { kind: "special",  key:  "continueWatching",                                    title:  "Continue watching"                                                            },
  // 8
  { kind: "movieRow", title: "We Think You'll Love These",                         fetcher: tmdb.weThinkYoullLove,               mediaType: "tv",    imageMode: "poster"   },
  // 9
  { kind: "movieRow", title: "Because you liked",                                  fetcher: tmdb.becauseYouLiked,                mediaType: "tv",    imageMode: "poster"   },
  // 10
  { kind: "movieRow", title: "Romantic East Asian TV Shows",                       fetcher: tmdb.romanticEastAsian,              mediaType: "tv",    imageMode: "poster"   },
  // 11 — Action → backdrop
  { kind: "movieRow", title: "Get in on the action",                               fetcher: tmdb.getInOnAction,                  mediaType: "tv",    imageMode: "backdrop" },
  // 12 — Movie promo art looks great in landscape
  { kind: "movieRow", title: "New Releases",                                       fetcher: tmdb.nowPlaying,                     mediaType: "movie", imageMode: "backdrop" },
  // 13
  { kind: "movieRow", title: "First Love Romance",                                 fetcher: tmdb.firstLoveRomance,               mediaType: "tv",    imageMode: "poster"   },
  // 14
  { kind: "movieRow", title: "K-Dramas",                                           fetcher: tmdb.koreanDramas,                   mediaType: "tv",    imageMode: "poster"   },
  // 15
  { kind: "movieRow", title: "Emotional Movie",                                    fetcher: tmdb.emotionalMovies,                mediaType: "movie", imageMode: "poster"   },
  // 16 — Eye Candy: visually lush portraits
  { kind: "movieRow", title: "Eye Candy",                                          fetcher: tmdb.eyeCandyMovies,                 mediaType: "movie", imageMode: "poster"   },
  // 17
  { kind: "movieRow", title: "US TV Shows",                                        fetcher: tmdb.usTVShows,                      mediaType: "tv",    imageMode: "poster"   },
  // 18
  { kind: "movieRow", title: "Critically Acclaimed TV Shows",                      fetcher: tmdb.awardWinningTV,                 mediaType: "tv",    imageMode: "poster"   },
  // 19
  { kind: "movieRow", title: "Love language",                                      fetcher: tmdb.romanticInternational,          mediaType: "tv",    imageMode: "poster"   },
  // 20
  { kind: "special",  key:  "myList",                                              title:  "My List"                                                                      },
  // 21
  { kind: "movieRow", title: "Downloads For You",                                  fetcher: tmdb.hindiTopRated,                  mediaType: "movie", imageMode: "poster"   },
  // 22
  { kind: "movieRow", title: "Can this love be translated",                        fetcher: tmdb.canThisLoveBeTranslated,        mediaType: "tv",    imageMode: "poster"   },
  // 23 — Fantasy worlds look cinematic in backdrop
  { kind: "movieRow", title: "Fantasy TV Shows",                                   fetcher: tmdb.scifiFantasyTV,                 mediaType: "tv",    imageMode: "backdrop" },
  // 24
  { kind: "movieRow", title: "Made in India",                                      fetcher: tmdb.madeInIndia,                    mediaType: "tv",    imageMode: "poster"   },
  // 25
  { kind: "top10",    title: "Top 10 Shows in India Today",                        fetcher: tmdb.top10TrendingShowsIndia,        mediaType: "tv"                           },
  // 26
  { kind: "movieRow", title: "Hidden Gems",                                        fetcher: tmdb.hiddenGems,                     mediaType: "movie", imageMode: "poster"   },
  // 27
  { kind: "movieRow", title: "Romantic International Opposites-Attract TV Dramas", fetcher: tmdb.oppositesAttract,               mediaType: "tv",    imageMode: "poster"   },
  // 28
  { kind: "movieRow", title: "Because You Watched",                                fetcher: tmdb.becauseYouWatched,              mediaType: "tv",    imageMode: "poster"   },
  // 29 — Mystery/noir → backdrop (dark, atmospheric)
  { kind: "movieRow", title: "Mysteries Dramas",                                   fetcher: tmdb.koreanThrillers,                mediaType: "tv",    imageMode: "backdrop" },
  // 30
  { kind: "movieRow", title: "US TV Comedies",                                     fetcher: tmdb.usTVComedies,                   mediaType: "tv",    imageMode: "poster"   },
  // 31 — Popular → backdrop (promotional stills)
  { kind: "movieRow", title: "Popular on Stream",                                  fetcher: tmdb.popularOnStream,                mediaType: "movie", imageMode: "backdrop" },
  // 32 — Suspense → backdrop
  { kind: "movieRow", title: "Suspenseful TV Shows",                               fetcher: tmdb.suspensefulTV,                  mediaType: "tv",    imageMode: "backdrop" },
  // 33
  { kind: "movieRow", title: "Korean TV Dramas",                                   fetcher: tmdb.popularKoreanTV,                mediaType: "tv",    imageMode: "poster"   },
  // 34
  { kind: "movieRow", title: "Romantic International TV Comedies",                 fetcher: tmdb.romanticIntlComedies,           mediaType: "tv",    imageMode: "poster"   },
  // 35 — Mind-bending → backdrop (conceptual stills)
  { kind: "movieRow", title: "Mind-Bending Stories",                               fetcher: tmdb.mindBendingStories,             mediaType: "movie", imageMode: "backdrop" },
  // 36
  { kind: "movieRow", title: "Familiar Favourite Series",                          fetcher: tmdb.familiarFavourites,             mediaType: "tv",    imageMode: "poster"   },
  // 37
  { kind: "movieRow", title: "Asian Movies & TV",                                  fetcher: tmdb.asianMovieTV,                   mediaType: "tv",    imageMode: "poster"   },
  // 38
  { kind: "movieRow", title: "J-Dramas",                                           fetcher: tmdb.japaneseTVShows,                mediaType: "tv",    imageMode: "poster"   },
  // 39 — Psychological thrillers → atmospheric backdrop
  { kind: "movieRow", title: "Psychological Thrillers",                            fetcher: tmdb.psychologicalThrillers,         mediaType: "movie", imageMode: "backdrop" },
  // 40
  { kind: "movieRow", title: "Anime",                                              fetcher: tmdb.animeTrending,                  mediaType: "tv",    imageMode: "poster"   },
  // 41
  { kind: "movieRow", title: "Bingeworthy TV Shows",                               fetcher: tmdb.bingeworthyTV,                  mediaType: "tv",    imageMode: "poster"   },
  // 42
  { kind: "movieRow", title: "Dreams to you",                                      fetcher: tmdb.dreamsToYou,                    mediaType: "tv",    imageMode: "poster"   },
  // 43
  { kind: "movieRow", title: "Critically Acclaimed US TV Dramas",                  fetcher: tmdb.criticallyAcclaimedUSDramas,   mediaType: "tv",    imageMode: "poster"   },
  // 44
  { kind: "movieRow", title: "Coming of Age",                                      fetcher: tmdb.youngAdult,                     mediaType: "movie", imageMode: "poster"   },
  // 45 — Everyone's Watching → backdrop (promo splash)
  { kind: "movieRow", title: "Everyone's Watching",                                fetcher: tmdb.everyonesWatching,              mediaType: "movie", imageMode: "backdrop" },
  // 46
  { kind: "movieRow", title: "Movies & TV Shows Dubbed in Telugu",                 fetcher: tmdb.teluguContent,                  mediaType: "tv",    imageMode: "poster"   },
  // 47 — Global picks → wide cinematic
  { kind: "movieRow", title: "Global Top Picks",                                   fetcher: tmdb.globalTopPicks,                 mediaType: "movie", imageMode: "backdrop" },
  // 48
  { kind: "movieRow", title: "Erase My Memory So I Can Watch Again",               fetcher: tmdb.eraseMyMemory,                  mediaType: "tv",    imageMode: "poster"   },
  // 49
  { kind: "movieRow", title: "Swoonworthy Romance",                                fetcher: tmdb.swoonworthyRomance,             mediaType: "tv",    imageMode: "poster"   },
  // 50 — Sci-Fi & Horror → backdrop
  { kind: "movieRow", title: "TV Sci-Fi & Horror",                                 fetcher: tmdb.sciFiHorrorTV,                  mediaType: "tv",    imageMode: "backdrop" },
  // 51 — Crowd pleasers → big-canvas backdrops
  { kind: "movieRow", title: "Crowd Pleasers",                                     fetcher: tmdb.crowdPleasers,                  mediaType: "tv",    imageMode: "backdrop" },
  // 52 — Netflix exclusives → iconic wide promotional art
  { kind: "movieRow", title: "Only On Netflix shows",                              fetcher: tmdb.onlyOnNetflix,                  mediaType: "tv",    imageMode: "backdrop" },
  // 53
  { kind: "movieRow", title: "Kids & Family",                                      fetcher: tmdb.kidsFamily,                     mediaType: "movie", imageMode: "poster"   },
  // 54 — Action movies → backdrop
  { kind: "movieRow", title: "Get In on the Action",                               fetcher: tmdb.actionAdventureMovies,          mediaType: "movie", imageMode: "backdrop" },
  // 55
  { kind: "top10",    title: "Top 10 Movie India",                                 fetcher: tmdb.top10MoviesIndia,               mediaType: "movie"                        },
  // 56 — Blockbusters → wide cinematic
  { kind: "movieRow", title: "Blockbuster Movies",                                 fetcher: tmdb.blockbusters,                   mediaType: "movie", imageMode: "backdrop" },
  // 57 — Horror/Thriller at night → dark backdrop
  { kind: "movieRow", title: "Late Night Watch",                                   fetcher: tmdb.lateNightWatch,                 mediaType: "movie", imageMode: "backdrop" },
  // 58 — IMDb Top Rated → iconic stills in landscape
  { kind: "movieRow", title: "IMDb Top Rated",                                     fetcher: tmdb.imdbTopRated,                   mediaType: "movie", imageMode: "backdrop" },
  // 59
  { kind: "movieRow", title: "Leaving Soon",                                       fetcher: tmdb.leavingSoon,                    mediaType: "movie", imageMode: "poster"   },
  // 60
  { kind: "movieRow", title: "Top 5 show by Netflix Korean",                       fetcher: tmdb.top5NetflixKorean,              mediaType: "tv",    imageMode: "poster"   },
  // 61 — S-Movie Original: curated prestige titles exclusive to this platform
  { kind: "movieRow", title: "Only On S-Movie original",                           fetcher: tmdb.onlyOnSMovie,                   mediaType: "movie", imageMode: "backdrop" },
];
