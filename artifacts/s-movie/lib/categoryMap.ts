/**
 * Home screen category map — single source of truth for the "which TMDB
 * query feeds which row" mapping.
 *
 * ALL 60 categories are permanently set here in the exact display order
 * specified. The hero banner appears above these rows.
 *
 * kind:
 *  - "movieRow"  → generic MovieRow with a tmdbFetcher
 *  - "top10"     → Top10Row (ranked 1-10)
 *  - "special"   → dedicated non-TMDB component (see index.tsx switch)
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
      key: "trendingNow" | "continueWatching" | "myList";
      title: string;
    };

// ─── 60 permanent rows — hero banner is above, these follow line by line ──────
export const HOME_CATEGORIES: HomeCategory[] = [
  // 1
  { kind: "movieRow", title: "Trending Now",                                        fetcher: tmdb.trendingMoviesDay,                  mediaType: "movie" },
  // 2
  { kind: "movieRow", title: "Meet Your Next Binge",                                fetcher: tmdb.meetNextBinge,                      mediaType: "tv"    },
  // 3
  { kind: "movieRow", title: "Your Next Watch",                                     fetcher: tmdb.yourNextWatch,                      mediaType: "tv"    },
  // 4
  { kind: "movieRow", title: "Korean TV Shows",                                     fetcher: tmdb.koreanDramasIN,                     mediaType: "tv"    },
  // 5
  { kind: "movieRow", title: "Romantic Shows",                                      fetcher: tmdb.romanticShows,                      mediaType: "tv"    },
  // 6
  { kind: "top10",    title: "Top 10 Movies in India Today",                        fetcher: tmdb.top10MoviesIndia,                   mediaType: "movie" },
  // 7
  { kind: "special",  key: "continueWatching",                                      title:   "Continue watching"                                         },
  // 8
  { kind: "movieRow", title: "We Think You'll Love These",                          fetcher: tmdb.weThinkYoullLove,                   mediaType: "tv"    },
  // 9
  { kind: "movieRow", title: "Because you liked",                                   fetcher: tmdb.becauseYouLiked,                    mediaType: "tv"    },
  // 10
  { kind: "movieRow", title: "Romantic East Asian TV Shows",                        fetcher: tmdb.romanticEastAsian,                  mediaType: "tv"    },
  // 11
  { kind: "movieRow", title: "Get in on the action",                                fetcher: tmdb.getInOnAction,                      mediaType: "tv"    },
  // 12
  { kind: "movieRow", title: "New Releases",                                        fetcher: tmdb.nowPlaying,                         mediaType: "movie" },
  // 13
  { kind: "movieRow", title: "First Love Romance",                                  fetcher: tmdb.firstLoveRomance,                   mediaType: "tv"    },
  // 14
  { kind: "movieRow", title: "K-Dramas",                                            fetcher: tmdb.koreanDramas,                       mediaType: "tv"    },
  // 15
  { kind: "movieRow", title: "Emotional Movie",                                     fetcher: tmdb.emotionalMovies,                    mediaType: "movie" },
  // 16
  { kind: "movieRow", title: "Eye Candy",                                           fetcher: tmdb.eyeCandyMovies,                     mediaType: "movie" },
  // 17
  { kind: "movieRow", title: "US TV Shows",                                         fetcher: tmdb.usTVShows,                          mediaType: "tv"    },
  // 18
  { kind: "movieRow", title: "Critically Acclaimed TV Shows",                       fetcher: tmdb.awardWinningTV,                     mediaType: "tv"    },
  // 19
  { kind: "movieRow", title: "Love language",                                       fetcher: tmdb.romanticInternational,              mediaType: "tv"    },
  // 20
  { kind: "special",  key: "myList",                                                title:   "My List"                                                   },
  // 21
  { kind: "movieRow", title: "Downloads For You",                                   fetcher: tmdb.hindiTopRated,                      mediaType: "movie" },
  // 22
  { kind: "movieRow", title: "Can this love be traslated",                          fetcher: tmdb.canThisLoveBeTranslated,            mediaType: "tv"    },
  // 23
  { kind: "movieRow", title: "Fantasy TV Shows",                                    fetcher: tmdb.scifiFantasyTV,                     mediaType: "tv"    },
  // 24
  { kind: "movieRow", title: "Made in India",                                       fetcher: tmdb.madeInIndia,                        mediaType: "tv"    },
  // 25
  { kind: "top10",    title: "Top 10 Shows in India Today",                         fetcher: tmdb.top10TrendingShowsIndia,            mediaType: "tv"    },
  // 26
  { kind: "movieRow", title: "Hidden Gems",                                         fetcher: tmdb.hiddenGems,                         mediaType: "movie" },
  // 27
  { kind: "movieRow", title: "Romantic International Opposites-Attract TV Dramas",  fetcher: tmdb.oppositesAttract,                   mediaType: "tv"    },
  // 28
  { kind: "movieRow", title: "Because You Watched",                                 fetcher: tmdb.becauseYouWatched,                  mediaType: "tv"    },
  // 29
  { kind: "movieRow", title: "Mysteries Dramas",                                    fetcher: tmdb.koreanThrillers,                    mediaType: "tv"    },
  // 30
  { kind: "movieRow", title: "US TV Comedies",                                      fetcher: tmdb.usTVComedies,                       mediaType: "tv"    },
  // 31
  { kind: "movieRow", title: "Popular on Stream",                                   fetcher: tmdb.popularOnStream,                    mediaType: "movie" },
  // 32
  { kind: "movieRow", title: "Suspenseful TV Shows",                                fetcher: tmdb.suspensefulTV,                      mediaType: "tv"    },
  // 33
  { kind: "movieRow", title: "Korean TV Dramas",                                    fetcher: tmdb.popularKoreanTV,                    mediaType: "tv"    },
  // 34
  { kind: "movieRow", title: "Romantic International TV Comedies",                  fetcher: tmdb.romanticIntlComedies,               mediaType: "tv"    },
  // 35
  { kind: "movieRow", title: "Mind-Bending Stories",                                fetcher: tmdb.mindBendingStories,                 mediaType: "movie" },
  // 36
  { kind: "movieRow", title: "Familiar Favourite Series",                           fetcher: tmdb.familiarFavourites,                 mediaType: "tv"    },
  // 37
  { kind: "movieRow", title: "Asian Movies & TV",                                   fetcher: tmdb.asianMovieTV,                       mediaType: "tv"    },
  // 38
  { kind: "movieRow", title: "J-Dramas",                                            fetcher: tmdb.japaneseTVShows,                    mediaType: "tv"    },
  // 39
  { kind: "movieRow", title: "Psychological Thrillers",                             fetcher: tmdb.psychologicalThrillers,             mediaType: "movie" },
  // 40
  { kind: "movieRow", title: "Anime",                                               fetcher: tmdb.animeTrending,                      mediaType: "tv"    },
  // 41
  { kind: "movieRow", title: "Bingeworthy TV Shows",                                fetcher: tmdb.bingeworthyTV,                      mediaType: "tv"    },
  // 42
  { kind: "movieRow", title: "Dreams to you",                                       fetcher: tmdb.dreamsToYou,                        mediaType: "tv"    },
  // 43
  { kind: "movieRow", title: "Critically Acclaimed US TV Dramas",                   fetcher: tmdb.criticallyAcclaimedUSDramas,        mediaType: "tv"    },
  // 44
  { kind: "movieRow", title: "Coming of Age",                                       fetcher: tmdb.youngAdult,                         mediaType: "movie" },
  // 45
  { kind: "movieRow", title: "Everyone's Watching",                                 fetcher: tmdb.everyonesWatching,                  mediaType: "movie" },
  // 46
  { kind: "movieRow", title: "Movies & TV Shows Dubbed in Telugu",                  fetcher: tmdb.teluguContent,                      mediaType: "tv"    },
  // 47
  { kind: "movieRow", title: "Global Top Picks",                                    fetcher: tmdb.globalTopPicks,                     mediaType: "movie" },
  // 48
  { kind: "movieRow", title: "Erase My Memory So I Can Watch Again",                fetcher: tmdb.eraseMyMemory,                      mediaType: "tv"    },
  // 49
  { kind: "movieRow", title: "Swoonworthy Romance",                                 fetcher: tmdb.swoonworthyRomance,                 mediaType: "tv"    },
  // 50
  { kind: "movieRow", title: "TV Sci-Fi & Horror",                                  fetcher: tmdb.sciFiHorrorTV,                      mediaType: "tv"    },
  // 51
  { kind: "movieRow", title: "Crowd Pleasers",                                      fetcher: tmdb.crowdPleasers,                      mediaType: "tv"    },
  // 52
  { kind: "movieRow", title: "Only On Netflix shows",                               fetcher: tmdb.onlyOnNetflix,                      mediaType: "tv"    },
  // 53
  { kind: "movieRow", title: "Kids & Family",                                       fetcher: tmdb.kidsFamily,                         mediaType: "movie" },
  // 54
  { kind: "movieRow", title: "Get In on the Action",                                fetcher: tmdb.actionAdventureMovies,              mediaType: "movie" },
  // 55
  { kind: "top10",    title: "Top 10 Movie India",                                  fetcher: tmdb.top10MoviesIndia,                   mediaType: "movie" },
  // 56
  { kind: "movieRow", title: "Blockbuster Movies",                                  fetcher: tmdb.blockbusters,                       mediaType: "movie" },
  // 57
  { kind: "movieRow", title: "Late Night Watch",                                    fetcher: tmdb.lateNightWatch,                     mediaType: "movie" },
  // 58
  { kind: "movieRow", title: "IMDb Top Rated",                                      fetcher: tmdb.imdbTopRated,                       mediaType: "movie" },
  // 59
  { kind: "movieRow", title: "Leaving Soon",                                        fetcher: tmdb.leavingSoon,                        mediaType: "movie" },
  // 60
  { kind: "movieRow", title: "Top 5 show by Netflix Korean",                        fetcher: tmdb.top5NetflixKorean,                  mediaType: "tv"    },
];
