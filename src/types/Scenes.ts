// 不用 enum 是因为模组无法扩展枚举值。
// const 对象保留字面量提示，类型开放为 string，这样有利于扩展
export const SCENES = {
  game: "game",
  config: "config",
  language: "language",
  menu: "menu",
  achievement: "achievement",
  archive: "archive",
} as const;

export type SceneId = string;
