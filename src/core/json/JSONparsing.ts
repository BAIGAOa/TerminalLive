import { readFile, writeFile } from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import z from "zod";

const _filename = fileURLToPath(import.meta.url);
const _dirname = dirname(_filename);

export default class JSONparsing {
  private configPath: string;

  constructor(configName: string) {
    this.configPath = this.getSrc(configName);
  }

  private getSrc(configName: string): string {
    // 使用当前工作目录作为项目根目录，确保配置文件在 src/ 下
    return path.join(_dirname, "..", "..", "..", "resource", configName);
  }

  public async loadingConfig(): Promise<any>;
  public async loadingConfig<T>(schema: z.ZodSchema<T>): Promise<T>;
  public async loadingConfig<T>(schema?: z.ZodSchema<T>): Promise<T | any> {
    try {
      const content = await readFile(this.configPath, "utf-8");

      if (!content || content.trim() === "") {
        throw new Error(`文件内容为空`);
      }

      const rawData = JSON.parse(content);
      if (schema) {
        return schema.parse(rawData);
      }
      return rawData;
    } catch (error) {
      throw new Error(
        `加载配置文件失败: ${this.configPath}\n${(error as Error).message}`,
      );
    }
  }

  public async saveConfig(data: unknown): Promise<void>;
  public async saveConfig<T>(data: T, schema: z.ZodSchema<T>): Promise<void>;
  public async saveConfig<T>(data: T, schema?: z.ZodSchema<T>): Promise<void> {
    if (schema) {
      schema.parse(data);
    }
    try {
      const content = JSON.stringify(data, null, 2);
      await writeFile(this.configPath, content, "utf-8");
    } catch (error) {
      throw new Error(
        `保存配置文件失败: ${this.configPath}\n${(error as Error).message}`,
      );
    }
  }
}
