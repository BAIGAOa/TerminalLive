import { Key, useInput } from "ink";
import { KeysConfig, keysConfigScheme } from "../../types/KeyboardMappingFormat.js";
import JSONparsing from "../json/JSONparsing.js";
import KeysCenter from "./KeysCenter.js";
import ScreenStore from "../store/ScreenStore.js";
import { container } from "../../Container.js";
import { Scenes } from "../../types/Scenes.js";

export default class KeyboardMonitor {

    private keyMap: Map<Scenes, Map<string, () => any>> = new Map();
    //如果为true则表示全局键盘监听关闭
    public static isSuspended: boolean = false

    private constructor(
        private configName: string,
        private keysCenter: KeysCenter
    ) { }


    /**
    * 静态实例创建工厂
    */
    public static async create(configName: string, keysCenter: KeysCenter): Promise<KeyboardMonitor> {
        const instance: KeyboardMonitor = new KeyboardMonitor(configName, keysCenter)
        const config = await instance.loadConfigFile()
        instance.applyConfig(config)
        return instance
    }


    private async loadConfigFile(): Promise<KeysConfig> {
        const jsonParse = new JSONparsing(this.configName);
        const content = await jsonParse.loadingConfig(keysConfigScheme);
        if (!content || !content.keys) {
            throw new Error("配置文件格式错误：缺少 keys 字段");
        }
        return content;
    }

    private applyConfig(config: KeysConfig): void {
        for (const item of config.keys) {
            const { keyName, operate, category } = item;

            // 将 category 统一转换为数组处理
            const categories: Scenes[] = Array.isArray(category) ? category : [category];

            // 从扁平化的 KeysCenter 获取操作函数（不再依赖场景参数）
            let action: () => any;
            try {
                action = this.keysCenter.getOperation(operate);
            } catch (e) {
                throw new Error(`配置中的操作 "${operate}" 未在 KeysCenter 中注册`);
            }

            // 将按键映射添加到每一个指定的场景
            for (const cat of categories) {
                let categoryMap = this.keyMap.get(cat);
                if (!categoryMap) {
                    categoryMap = new Map<string, () => any>();
                    this.keyMap.set(cat, categoryMap);
                }

                if (categoryMap.has(keyName)) {
                    throw new Error(`分类 "${cat}" 下重复定义键 "${keyName}"`);
                }

                categoryMap.set(keyName, action);
            }
        }
    }


    private normalizeKeyName(input: string, key: Key): string[] {
        const keys: string[] = [];

        // 1. 处理特殊键（如 return、escape、方向键等）
        const specialKeys: [keyof Key, string][] = [
            ['return', 'return'],
            ['escape', 'escape'],
            ['backspace', 'backspace'],
            ['delete', 'delete'],
            ['upArrow', 'up'],
            ['downArrow', 'down'],
            ['leftArrow', 'left'],
            ['rightArrow', 'right'],
            ['tab', 'tab'],
        ];

        for (const [keyProp, keyName] of specialKeys) {
            if (key[keyProp]) {
                keys.push(keyName);
                // 特殊键也可能有修饰符，如 ctrl+return
                if (key.ctrl) keys.push(`ctrl+${keyName}`);
                if (key.shift) keys.push(`shift+${keyName}`);
                if (key.meta) keys.push(`meta+${keyName}`);
                return keys;
            }
        }

        // 处理普通字符键
        if (input) {
            // 无修饰符的普通键
            keys.push(input);

            // 带修饰符的组合键
            if (key.ctrl) keys.push(`ctrl+${input}`);
            if (key.shift) keys.push(`shift+${input}`);
            if (key.meta) keys.push(`meta+${input}`);

            // 多修饰符组合（如 ctrl+shift+k）
            if (key.ctrl && key.shift) keys.push(`ctrl+shift+${input}`);
            if (key.ctrl && key.meta) keys.push(`ctrl+meta+${input}`);
        }

        return keys;
    }


    public handleInput(input: string, key: Key): boolean {
        if (KeyboardMonitor.isSuspended) {
            return false
        }
        const currentScene = container.resolve(ScreenStore).getSnapshot();
        const categoryMap = this.keyMap.get(currentScene);
        if (!categoryMap) return false;
        // 获取当前按键的所有可能名称
        const possibleNames = this.normalizeKeyName(input, key);
        // 匹配配置中的按键名
        for (const name of possibleNames) {
            if (categoryMap.has(name)) {
                categoryMap.get(name)!();
                return true;
            }
        }
        return false;
    }
}

export function useKeyboardMonitor(monitor: KeyboardMonitor) {
    useInput((input, key) => {
        monitor.handleInput(input, key);
    });
}
