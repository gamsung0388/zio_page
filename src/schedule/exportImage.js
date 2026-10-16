import {
  CANVAS_SIZE,
  EXPORT_OPTIONS,
} from "../../shared/schedule/scheduleConfig.js";
import { waitForImagesLoaded } from "./imageLoading.js";

export async function exportElementImage(
  element,
  type = "png",
  filename = "zio-weekly-schedule",
) {
  if (!element) throw new Error("미리보기가 준비되지 않았어요.");
  const option = Object.hasOwn(EXPORT_OPTIONS, type)
    ? EXPORT_OPTIONS[type]
    : EXPORT_OPTIONS.png;
  await waitForImagesLoaded(element);
  await document.fonts.ready;
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    width: CANVAS_SIZE.width,
    height: CANVAS_SIZE.height,
    windowWidth: CANVAS_SIZE.width,
    windowHeight: CANVAS_SIZE.height,
    scale: 1,
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    logging: false,
    onclone(documentClone, canvasClone) {
      // 미리보기 확대/축소와 스크롤의 영향을 복제 문서에서만 제거한다.
      documentClone.body.appendChild(canvasClone);
      canvasClone.classList.add("exporting");
      Object.assign(canvasClone.style, {
        position: "absolute",
        left: "0",
        top: "0",
        margin: "0",
        transform: "none",
      });
    },
  });

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("이미지 변환에 실패했어요. 다시 시도해주세요."));
      },
      option.mimeType,
      option.quality,
    );
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename + "." + option.extension;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // 다운로드가 URL을 읽을 시간을 준 뒤 메모리를 반환한다.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
