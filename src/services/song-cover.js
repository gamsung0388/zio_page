// Decorative covers are local illustrations, not fetched album artwork.
const covers = {
  가요: "cherry",
  발라드: "night",
  팝: "city",
  애니: "sunset",
  재즈: "room",
  기타: "ocean",
};
export function songCover(song) {
  return (
    song.cover ||
    "/images/covers/" +
      (Object.hasOwn(covers, song.genre) ? covers[song.genre] : "night") +
      ".svg"
  );
}
