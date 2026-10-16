export function getFieldStyle(layout, options, index, kind) {
  const isContent = kind === "content";
  return {
    top: layout.startTop + index * layout.rowGap + "%",
    height: layout.rowHeight + "%",
    left: (isContent ? layout.contentLeft : layout.timeLeft) + "%",
    width: (isContent ? layout.contentWidth : layout.timeWidth) + "%",
    fontSize:
      (isContent ? options.contentFontSize : options.timeFontSize) + "px",
    color: options.textColor,
    fontWeight: options.bold ? "900" : "400",
    textAlign: isContent ? options.align : "center",
  };
}

export function formatTime(value, hideColon) {
  return hideColon ? value.replaceAll(":", "") : value;
}
