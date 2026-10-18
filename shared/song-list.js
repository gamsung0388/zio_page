export function songListHasFilters(filters, admin = false) {
  return [
    "q",
    "proficiency",
    "practice_status",
    "genre",
    "language",
    ...(admin ? ["is_public"] : []),
  ].some((key) => Boolean(filters[key]));
}
export function songListEmptyInfo(filtered, admin = false) {
  if (filtered)
    return {
      title: "검색 조건에 맞는 노래가 없어요",
      message: "검색어를 바꾸거나 필터를 초기화해보세요.",
    };
  return admin
    ? {
        title: "등록된 노래가 없어요",
        message:
          "새 노래를 등록하거나 CSV 파일을 가져와 노래책자를 채워보세요.",
      }
    : {
        title: "아직 등록된 노래가 없어요",
        message: "노래책자를 채워가는 중이에요. 조금만 기다려주세요.",
      };
}
