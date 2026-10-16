export function waitForImage(image, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let timer;
    function finish(error) {
      clearTimeout(timer);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    function onLoad() {
      if (image.naturalWidth > 0) finish();
      else onError();
    }
    function onError() {
      finish(
        new Error("템플릿을 불러오지 못했어요. 새로고침 후 다시 시도해주세요."),
      );
    }
    image.addEventListener("load", onLoad);
    image.addEventListener("error", onError);
    timer = setTimeout(
      () =>
        finish(new Error("템플릿 로딩 시간이 초과됐어요. 다시 시도해주세요.")),
      timeoutMs,
    );
    // 이벤트 등록 전에 실패했거나 캐시에서 이미 로드된 경우에도 종료한다.
    if (image.complete) onLoad();
  });
}

export function waitForImagesLoaded(element) {
  return Promise.all(
    Array.from(element.querySelectorAll("img"), (image) => waitForImage(image)),
  );
}
