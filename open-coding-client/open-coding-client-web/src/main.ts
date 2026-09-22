import { createApp } from 'vue';
import { createPinia } from 'pinia';
import TDesign from 'tdesign-vue-next';
import Chat from '@tdesign-vue-next/chat';
import App from './App.vue';
import router from './router';
import 'tdesign-vue-next/es/style/index.css';
import '@tdesign-vue-next/chat/es/style/index.css';
import './styles/index.scss';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(TDesign);
app.use(Chat);

/** 无障碍：减少动效与字号缩放偏好（本地记忆） */
const motion = localStorage.getItem('oc.motion');
if (motion === 'reduced') document.documentElement.dataset.motion = 'reduced';
const scale = localStorage.getItem('oc.fontScale');
if (scale) document.documentElement.style.setProperty('--oc-font-scale', scale);
const theme = localStorage.getItem('oc.theme');
if (theme === 'dark') document.documentElement.setAttribute('theme-mode', 'dark');

app.mount('#app');
