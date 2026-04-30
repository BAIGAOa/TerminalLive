import AchievementStore from "../achievement/AchievementStore.js"
import { container } from "../Container.js"
import { AchievementCategory } from "../types/AchievementCategory.js"



export default class Achievements {
    public static init: boolean = false


    public static load() {
        if (!this.init) {
            this.init = true

            // 如果换成container.reslove(AchievementStore).register就会报错
            // 我真的不明白，可能我对di-wise这个库不太了解还是对这门语言不够精通
            const store = container.resolve(AchievementStore)
            store.register({
                id: 'born',
                nameKey: 'achievement.born',
                descriptionKey: 'achievement.born.description',
                category: AchievementCategory.base,
                conditions: [
                    {
                        type: 'statThreshold',
                        stat: 'age',
                        value: 1,
                        comparator: 'gte'
                    }
                ]
            })
        }
    }
}
