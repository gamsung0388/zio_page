import { ref } from "vue";
export const notification = ref("");
let timer;
export function notify(message) {
  clearTimeout(timer);
  notification.value = message;
  timer = setTimeout(() => {
    notification.value = "";
  }, 7000);
}
