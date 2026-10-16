import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";
import "./styles/main.css";
import "./assets/main.css";
import "./styles/integration.css";
import "./styles/schedule.css";
createApp(App).use(router).mount("#app");
