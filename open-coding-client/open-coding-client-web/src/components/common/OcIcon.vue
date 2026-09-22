<script setup lang="ts">
/**
 * 图标统一入口。
 * 业务只使用语义化 name（如 "tools"/"permission"），未知名称回退到默认图标，
 * 保证新增页面不会因为图标名拼写导致构建失败。
 */
import { computed } from 'vue';
import {
  AddIcon, ApiIcon, AppIcon, BookmarkIcon, BrowseIcon, BugIcon, CalendarIcon, ChartBarIcon,
  ChartBubbleIcon, ChartIcon, ChartLineIcon, ChartPieIcon, ChatBubbleIcon, ChatIcon, CheckCircleIcon,
  CloseCircleIcon, CloudIcon, CodeIcon, ControlPlatformIcon, CopyIcon, DashboardIcon, DataBaseIcon,
  DeleteIcon, DiscountIcon, DownloadIcon, EditIcon, ErrorCircleIcon, ExtensionIcon, FileAddIcon,
  FileCopyIcon, FileIcon, FilterIcon, FlagIcon, FolderIcon, FolderOpenIcon, GitBranchIcon,
  HeartIcon, HelpCircleIcon, HistoryIcon, ImageIcon, LayersIcon, LightbulbIcon, LinkIcon,
  LoadingIcon, LockOnIcon, LogoutIcon, MailIcon, MicrophoneIcon, NotificationIcon, RefreshIcon,
  RobotIcon, RootListIcon, SearchIcon, SecuredIcon, ServerIcon, SettingIcon, ShareIcon,
  SitemapIcon, SmileIcon, SoundIcon, StarIcon, SystemMessagesIcon, TaskCheckedIcon, TaskIcon,
  TerminalIcon, ThumbDownIcon, ThumbUpIcon, TimeIcon, ToolsIcon, UploadIcon, UserCircleIcon,
  UserIcon, VideoIcon, AudioIcon, QrcodeIcon,
} from 'tdesign-icons-vue-next';

const registry: Record<string, unknown> = {
  add: AddIcon, api: ApiIcon, app: AppIcon, audio: AudioIcon, bookmark: BookmarkIcon,
  browse: BrowseIcon, bug: BugIcon, calendar: CalendarIcon, chart: ChartIcon,
  'chart-bar': ChartBarIcon, 'chart-bubble': ChartBubbleIcon, 'chart-line': ChartLineIcon,
  'chart-pie': ChartPieIcon, chat: ChatIcon, 'chat-bubble': ChatBubbleIcon, check: CheckCircleIcon,
  close: CloseCircleIcon, cloud: CloudIcon, code: CodeIcon, platform: ControlPlatformIcon,
  copy: CopyIcon, dashboard: DashboardIcon, database: DataBaseIcon, delete: DeleteIcon,
  discount: DiscountIcon, download: DownloadIcon, edit: EditIcon, error: ErrorCircleIcon,
  extension: ExtensionIcon, file: FileIcon, 'file-add': FileAddIcon, 'file-copy': FileCopyIcon,
  filter: FilterIcon, flag: FlagIcon, folder: FolderIcon, 'folder-open': FolderOpenIcon,
  git: GitBranchIcon, heart: HeartIcon, help: HelpCircleIcon, history: HistoryIcon,
  image: ImageIcon, layers: LayersIcon, lightbulb: LightbulbIcon, link: LinkIcon,
  loading: LoadingIcon, lock: LockOnIcon, logout: LogoutIcon, mail: MailIcon,
  microphone: MicrophoneIcon, notification: NotificationIcon, qrcode: QrcodeIcon,
  refresh: RefreshIcon, robot: RobotIcon, root: RootListIcon, search: SearchIcon,
  secured: SecuredIcon, server: ServerIcon, setting: SettingIcon, share: ShareIcon,
  sitemap: SitemapIcon, smile: SmileIcon, sound: SoundIcon, star: StarIcon,
  system: SystemMessagesIcon, task: TaskIcon, 'task-checked': TaskCheckedIcon, terminal: TerminalIcon,
  'thumb-down': ThumbDownIcon, 'thumb-up': ThumbUpIcon, time: TimeIcon, tools: ToolsIcon,
  upload: UploadIcon, user: UserIcon, 'user-circle': UserCircleIcon, video: VideoIcon,
};

const props = withDefaults(defineProps<{ name: string; size?: string | number; color?: string }>(), {
  size: '1em',
  color: undefined,
});

const comp = computed(() => (registry[props.name] ?? AppIcon) as never);
</script>

<template>
  <component :is="comp" :size="size" :style="color ? { color } : undefined" />
</template>
