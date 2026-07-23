/**
 * Home screen category map — single source of truth for all 90 rows.
 *
 * imageMode:
 *  "poster"   → tall portrait 2:3 card (default)
 *  "backdrop" → wide landscape crop (action, thriller, sci-fi, blockbusters)
 *
 * Show-specific recommendation rows use tmdb.tvRecommendations(tmdbId) which
 * hits /tv/{id}/recommendations — gracefully collapses if empty.
 *
 * TMDB list rows (categories 85-89) use tmdb.list(listId) — community/official
 * curated lists. IDs provided by user and stripped from the display title.
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

// ─── 90 permanent rows ─────────────────────────────────────────────────────────
export const HOME_CATEGORIES: HomeCategory[] = [
  // 1  — Trending: cinematic wide shots → backdrop
  { kind: "movieRow", title: "Trending Now",                                        fetcher: tmdb.trendingMoviesDay,              mediaType: "movie", imageMode: "backdrop" },
  // 2
  { kind: "movieRow", title: "Meet Your Next Binge",                                fetcher: tmdb.meetNextBinge,                  mediaType: "tv",    imageMode: "poster"   },
  // 3
  { kind: "movieRow", title: "Your Next Watch",                                     fetcher: tmdb.yourNextWatch,                  mediaType: "tv",    imageMode: "poster"   },
  // 4
  { kind: "movieRow", title: "Korean TV Shows",                                     fetcher: tmdb.koreanDramasIN,                 mediaType: "tv",    imageMode: "poster"   },
  // 5
  { kind: "movieRow", title: "Romantic Shows",                                      fetcher: tmdb.romanticShows,                  mediaType: "tv",    imageMode: "poster"   },
  // 6 — Netflix-only content
  { kind: "top10",    title: "Top 10 Movies in India Today",                        fetcher: tmdb.top10NetflixIndia,              mediaType: "movie"                        },
  // 7
  { kind: "special",  key:  "continueWatching",                                     title:  "Continue watching"                                                            },
  // 8
  { kind: "movieRow", title: "We Think You'll Love These",                          fetcher: tmdb.weThinkYoullLove,               mediaType: "tv",    imageMode: "poster"   },
  // 9
  { kind: "movieRow", title: "Made in Korea",                                       fetcher: tmdb.madeInKorea,                    mediaType: "tv",    imageMode: "poster"   },
  // 10 — recommendations for "It's Okay to Not Be Okay" (TMDB TV 95639)
  { kind: "movieRow", title: "It's Okay to Not Be Okay",                           fetcher: tmdb.tvRecommendations(95639),       mediaType: "tv",    imageMode: "poster"   },
  // 11
  { kind: "movieRow", title: "Because you liked",                                   fetcher: tmdb.becauseYouLiked,                mediaType: "tv",    imageMode: "poster"   },
  // 12
  { kind: "movieRow", title: "Romantic East Asian TV Shows",                        fetcher: tmdb.romanticEastAsian,              mediaType: "tv",    imageMode: "poster"   },
  // 13 — action → backdrop
  { kind: "movieRow", title: "Get in on the action",                                fetcher: tmdb.getInOnAction,                  mediaType: "tv",    imageMode: "backdrop" },
  // 14 — movie promo art → backdrop
  { kind: "movieRow", title: "New Releases",                                        fetcher: tmdb.nowPlaying,                     mediaType: "movie", imageMode: "backdrop" },
  // 15
  { kind: "movieRow", title: "First Love Romance",                                  fetcher: tmdb.firstLoveRomance,               mediaType: "tv",    imageMode: "poster"   },
  // 16
  { kind: "movieRow", title: "K-Dramas",                                            fetcher: tmdb.koreanDramas,                   mediaType: "tv",    imageMode: "poster"   },
  // 17 — recommendations for "Do You Like Brahms?" (TMDB TV 102922)
  { kind: "movieRow", title: "Do You Like Brahms",                                  fetcher: tmdb.tvRecommendations(102922),      mediaType: "tv",    imageMode: "poster"   },
  // 18
  { kind: "movieRow", title: "Emotional Movie",                                     fetcher: tmdb.emotionalMovies,                mediaType: "movie", imageMode: "poster"   },
  // 19
  { kind: "movieRow", title: "Eye Candy",                                           fetcher: tmdb.eyeCandyMovies,                 mediaType: "movie", imageMode: "poster"   },
  // 20 — Netflix originals sorted by recency → backdrop
  { kind: "movieRow", title: "New on Netflix",                                      fetcher: tmdb.newOnNetflix,                   mediaType: "tv",    imageMode: "backdrop" },
  // 21
  { kind: "movieRow", title: "US TV Shows",                                         fetcher: tmdb.usTVShows,                      mediaType: "tv",    imageMode: "poster"   },
  // 22
  { kind: "movieRow", title: "Critically Acclaimed TV Shows",                       fetcher: tmdb.awardWinningTV,                 mediaType: "tv",    imageMode: "poster"   },
  // 23
  { kind: "movieRow", title: "Love language",                                       fetcher: tmdb.romanticInternational,          mediaType: "tv",    imageMode: "poster"   },
  // 24
  { kind: "special",  key:  "myList",                                               title:  "My List"                                                                      },
  // 25
  { kind: "movieRow", title: "Downloads For You",                                   fetcher: tmdb.hindiTopRated,                  mediaType: "movie", imageMode: "poster"   },
  // 26 — broad Asian TV
  { kind: "movieRow", title: "Asian TV Shows",                                      fetcher: tmdb.asianTVShows,                   mediaType: "tv",    imageMode: "poster"   },
  // 27
  { kind: "movieRow", title: "Can this love be traslated",                          fetcher: tmdb.canThisLoveBeTranslated,        mediaType: "tv",    imageMode: "poster"   },
  // 28 — fantasy worlds → backdrop
  { kind: "movieRow", title: "Fantasy TV Shows",                                    fetcher: tmdb.scifiFantasyTV,                 mediaType: "tv",    imageMode: "backdrop" },
  // 29
  { kind: "movieRow", title: "Made in India",                                       fetcher: tmdb.madeInIndia,                    mediaType: "tv",    imageMode: "poster"   },
  // 30
  { kind: "top10",    title: "Top 10 Shows in India Today",                         fetcher: tmdb.top10TrendingShowsIndia,        mediaType: "tv"                           },
  // 31
  { kind: "movieRow", title: "Hidden Gems",                                         fetcher: tmdb.hiddenGems,                     mediaType: "movie", imageMode: "poster"   },
  // 32
  { kind: "movieRow", title: "Romantic International Opposites-Attract TV Dramas",  fetcher: tmdb.oppositesAttract,               mediaType: "tv",    imageMode: "poster"   },
  // 33 — recommendations for "Moving" (2023 Korean superhero, TMDB TV 225543)
  { kind: "movieRow", title: "Because You Watched The East",                        fetcher: tmdb.tvRecommendations(225543),      mediaType: "tv",    imageMode: "poster"   },
  // 34 — mystery/noir → backdrop
  { kind: "movieRow", title: "Mysteries Dramas",                                    fetcher: tmdb.koreanThrillers,                mediaType: "tv",    imageMode: "backdrop" },
  // 35
  { kind: "movieRow", title: "US TV Comedies",                                      fetcher: tmdb.usTVComedies,                   mediaType: "tv",    imageMode: "poster"   },
  // 36 — recommendations for "Mr. Queen" (2020, TMDB TV 111050) — palace drama
  { kind: "movieRow", title: "Because you watched The Palace",                      fetcher: tmdb.tvRecommendations(111050),      mediaType: "tv",    imageMode: "poster"   },
  // 37 — popular → backdrop
  { kind: "movieRow", title: "Popular on Stream",                                   fetcher: tmdb.popularOnStream,                mediaType: "movie", imageMode: "backdrop" },
  // 38 — suspense → backdrop
  { kind: "movieRow", title: "Suspenseful TV Shows",                                fetcher: tmdb.suspensefulTV,                  mediaType: "tv",    imageMode: "backdrop" },
  // 39
  { kind: "movieRow", title: "Korean TV Dramas",                                    fetcher: tmdb.popularKoreanTV,                mediaType: "tv",    imageMode: "poster"   },
  // 40
  { kind: "movieRow", title: "Romantic International TV Comedies",                  fetcher: tmdb.romanticIntlComedies,           mediaType: "tv",    imageMode: "poster"   },
  // 41 — Korean action → backdrop
  { kind: "movieRow", title: "Korean TV Action & Adventure",                        fetcher: tmdb.koreanActionTV,                 mediaType: "tv",    imageMode: "backdrop" },
  // 42 — mind-bending → backdrop
  { kind: "movieRow", title: "Mind-Bending Stories",                                fetcher: tmdb.mindBendingStories,             mediaType: "movie", imageMode: "backdrop" },
  // 43
  { kind: "movieRow", title: "Familiar Favourite Series",                           fetcher: tmdb.familiarFavourites,             mediaType: "tv",    imageMode: "poster"   },
  // 44
  { kind: "movieRow", title: "Asian Movies & TV",                                   fetcher: tmdb.asianMovieTV,                   mediaType: "tv",    imageMode: "poster"   },
  // 45
  { kind: "movieRow", title: "J-Dramas",                                            fetcher: tmdb.japaneseTVShows,                mediaType: "tv",    imageMode: "poster"   },
  // 46 — psychological thrillers → dark backdrop
  { kind: "movieRow", title: "Psychological Thrillers",                             fetcher: tmdb.psychologicalThrillers,         mediaType: "movie", imageMode: "backdrop" },
  // 47
  { kind: "movieRow", title: "Anime",                                               fetcher: tmdb.animeTrending,                  mediaType: "tv",    imageMode: "poster"   },
  // 48
  { kind: "movieRow", title: "Bingeworthy TV Shows",                                fetcher: tmdb.bingeworthyTV,                  mediaType: "tv",    imageMode: "poster"   },
  // 49
  { kind: "movieRow", title: "Dreams to you",                                       fetcher: tmdb.dreamsToYou,                    mediaType: "tv",    imageMode: "poster"   },
  // 50
  { kind: "movieRow", title: "Critically Acclaimed US TV Dramas",                   fetcher: tmdb.criticallyAcclaimedUSDramas,   mediaType: "tv",    imageMode: "poster"   },
  // 51
  { kind: "movieRow", title: "Coming of Age",                                       fetcher: tmdb.youngAdult,                     mediaType: "movie", imageMode: "poster"   },
  // 52 — Everyone's Watching → backdrop
  { kind: "movieRow", title: "Everyone's Watching",                                 fetcher: tmdb.everyonesWatching,              mediaType: "movie", imageMode: "backdrop" },
  // 53
  { kind: "movieRow", title: "Movies & TV Shows Dubbed in Telugu",                  fetcher: tmdb.teluguContent,                  mediaType: "tv",    imageMode: "poster"   },
  // 54 — global picks → wide cinematic
  { kind: "movieRow", title: "Global Top Picks",                                    fetcher: tmdb.globalTopPicks,                 mediaType: "movie", imageMode: "backdrop" },
  // 55
  { kind: "movieRow", title: "Erase My Memory So I Can Watch Again",                fetcher: tmdb.eraseMyMemory,                  mediaType: "tv",    imageMode: "poster"   },
  // 56
  { kind: "movieRow", title: "Swoonworthy Romance",                                 fetcher: tmdb.swoonworthyRomance,             mediaType: "tv",    imageMode: "poster"   },
  // 57 — sci-fi & horror → backdrop
  { kind: "movieRow", title: "TV Sci-Fi & Horror",                                  fetcher: tmdb.sciFiHorrorTV,                  mediaType: "tv",    imageMode: "backdrop" },
  // 58 — crowd pleasers → backdrop
  { kind: "movieRow", title: "Crowd Pleasers",                                      fetcher: tmdb.crowdPleasers,                  mediaType: "tv",    imageMode: "backdrop" },
  // 59 — Netflix exclusives → backdrop
  { kind: "movieRow", title: "Only On Netflix shows",                               fetcher: tmdb.onlyOnNetflix,                  mediaType: "tv",    imageMode: "backdrop" },
  // 60
  { kind: "movieRow", title: "Kids & Family",                                       fetcher: tmdb.kidsFamily,                     mediaType: "movie", imageMode: "poster"   },
  // 61 — action movies → backdrop
  { kind: "movieRow", title: "Get In on the Action",                                fetcher: tmdb.actionAdventureMovies,          mediaType: "movie", imageMode: "backdrop" },
  // 62
  { kind: "top10",    title: "Top 10 Movie India",                                  fetcher: tmdb.top10MoviesIndia,               mediaType: "movie"                        },
  // 63 — blockbusters → wide cinematic
  { kind: "movieRow", title: "Blockbuster Movies",                                  fetcher: tmdb.blockbusters,                   mediaType: "movie", imageMode: "backdrop" },
  // 64 — horror/thriller at night → dark backdrop
  { kind: "movieRow", title: "Late Night Watch",                                    fetcher: tmdb.lateNightWatch,                 mediaType: "movie", imageMode: "backdrop" },
  // 65 — IMDb Top Rated → iconic stills in landscape
  { kind: "movieRow", title: "IMDb Top Rated",                                      fetcher: tmdb.imdbTopRated,                   mediaType: "movie", imageMode: "backdrop" },
  // 66
  { kind: "movieRow", title: "Leaving Soon",                                        fetcher: tmdb.leavingSoon,                    mediaType: "movie", imageMode: "poster"   },
  // 67
  { kind: "movieRow", title: "Top 5 show by Netflix Korean",                        fetcher: tmdb.top5NetflixKorean,              mediaType: "tv",    imageMode: "poster"   },
  // 68 — S-Movie curated prestige titles
  { kind: "movieRow", title: "Only On S-Movie original",                            fetcher: tmdb.onlyOnSMovie,                   mediaType: "movie", imageMode: "backdrop" },
  // 69 — top-rated anime series (distinct pool from #47)
  { kind: "movieRow", title: "Anime Series",                                        fetcher: tmdb.animeSeries,                    mediaType: "tv",    imageMode: "poster"   },
  // 70 — ethereal romance TV (same pool, alternate position)
  { kind: "movieRow", title: "Dream to you",                                        fetcher: tmdb.dreamsToYou,                    mediaType: "tv",    imageMode: "poster"   },
  // 71
  { kind: "movieRow", title: "Indian Movies",                                       fetcher: tmdb.indianMovies,                   mediaType: "movie", imageMode: "poster"   },
  // 72
  { kind: "movieRow", title: "Romantic Indian movies",                              fetcher: tmdb.romanticIndianMovies,           mediaType: "movie", imageMode: "poster"   },
  // 73
  { kind: "movieRow", title: "Desi & chil",                                         fetcher: tmdb.desiAndChill,                   mediaType: "tv",    imageMode: "poster"   },
  // 74 — recommendations for "A Piece of Your Mind" (TMDB TV 99024)
  { kind: "movieRow", title: "A Piece of Your Mind",                                fetcher: tmdb.tvRecommendations(99024),       mediaType: "tv",    imageMode: "poster"   },
  // 75 — recommendations for "Goblin / Guardian" (TMDB TV 68865)
  { kind: "movieRow", title: "The Lonely and Great God",                            fetcher: tmdb.tvRecommendations(68865),       mediaType: "tv",    imageMode: "poster"   },
  // 76 — recommendations for "Sweet Home" (TMDB TV 109545)
  { kind: "movieRow", title: "Sweet home",                                          fetcher: tmdb.tvRecommendations(109545),      mediaType: "tv",    imageMode: "poster"   },
  // 77 — recommendations for "Our Beloved Summer" (TMDB TV 123249)
  { kind: "movieRow", title: "Our Beloved Summer",                                  fetcher: tmdb.tvRecommendations(123249),      mediaType: "tv",    imageMode: "poster"   },
  // 78 — recommendations for "When the Weather is Fine" (TMDB TV 96821)
  { kind: "movieRow", title: "When the Weather is Fine",                            fetcher: tmdb.tvRecommendations(96821),       mediaType: "tv",    imageMode: "poster"   },
  // 79 — recommendations for "When Life Gives You Tangerines" (TMDB TV 280648)
  { kind: "movieRow", title: "When Life Gives You Tangerines",                      fetcher: tmdb.tvRecommendations(280648),      mediaType: "tv",    imageMode: "poster"   },
  // 80 — recommendations for "Twenty-Five Twenty-One" (TMDB TV 159155)
  { kind: "movieRow", title: "Twenty-Five Twenty-One",                              fetcher: tmdb.tvRecommendations(159155),      mediaType: "tv",    imageMode: "poster"   },
  // 81 — recommendations for "Lovely Runner" (TMDB TV 237811)
  { kind: "movieRow", title: "Lovely Runner",                                       fetcher: tmdb.tvRecommendations(237811),      mediaType: "tv",    imageMode: "poster"   },
  // 82
  { kind: "movieRow", title: "Romantic Comedies",                                   fetcher: tmdb.romanticComedies,               mediaType: "movie", imageMode: "poster"   },
  // 83 — US (English) movies with Hindi spoken audio
  { kind: "movieRow", title: "US Movies dubbed in Hindi",                           fetcher: tmdb.usMoviesDubbedInHindi,          mediaType: "movie", imageMode: "poster"   },
  // 84 — recommendations for "Alice in Borderland" (TMDB TV 108545)
  { kind: "movieRow", title: "Alice in borderland",                                 fetcher: tmdb.tvRecommendations(108545),      mediaType: "tv",    imageMode: "poster"   },
  // 85 — TMDB curated list 4729 (Romantic Indian Dramas)
  { kind: "movieRow", title: "Romantic Indian Dramas",                              fetcher: (p) => tmdb.list(4729, p),           mediaType: "tv",    imageMode: "poster"   },
  // 86 — TMDB curated list 31574 (Classics)
  { kind: "movieRow", title: "Classics",                                            fetcher: (p) => tmdb.list(31574, p),          mediaType: "movie", imageMode: "backdrop" },
  // 87 — TMDB curated list 783 (Children & Family Films)
  { kind: "movieRow", title: "Children & Family Films",                             fetcher: (p) => tmdb.list(783, p),            mediaType: "movie", imageMode: "poster"   },
  // 88 — TMDB curated list 1492 (Sci-Fi & Fantasy)
  { kind: "movieRow", title: "Sci-Fi & Fantasy",                                    fetcher: (p) => tmdb.list(1492, p),           mediaType: "movie", imageMode: "backdrop" },
  // 89 — TMDB curated list 8933 (Thrillers)
  { kind: "movieRow", title: "Thrillers",                                           fetcher: (p) => tmdb.list(8933, p),           mediaType: "movie", imageMode: "backdrop" },
  // 90 — global daily trending TV (all regions combined)
  { kind: "top10",    title: "Top 10 Shows in All Country Today",                   fetcher: tmdb.top10ShowsAllCountries,         mediaType: "tv"                           },
];
