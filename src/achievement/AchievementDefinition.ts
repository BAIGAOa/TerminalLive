import z from "zod";

/**当某个事件发生的时候，成就会解锁*/
const EventBasedUnlocking = z.object({
  type: z.literal("incident"),
  incidentId: z.string(),
});

const AchievementUnlockedCondition = z.union([EventBasedUnlocking]);

export const AchievementSchema = z.object({
  /**成就的id必须要有一个长度的字符串不能为空*/
  id: z.string().min(1),
  /**成就对外显示的名称，使用翻译key*/
  nameKey: z.string(),
  /**关于这个成就的描述*/
  descriptionKey: z.string(),
  /**这个成就处于哪个分类当中*/
  category: z.string(),
  /**或条件，如果为真，那么只需要满足其中一个条件即可，否则都要满足*/
  orCondition: z.boolean().optional(),
  /**成就解锁的条件可以是数组*/
  conditions: z.array(AchievementUnlockedCondition),
  hidden: z.boolean().optional(),
});

export type Achievement = z.infer<typeof AchievementSchema>;
