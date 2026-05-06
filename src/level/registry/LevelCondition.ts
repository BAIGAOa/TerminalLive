import Player from "../../world/Player.js";

export default abstract class LevelCondition {
    /**
    * 此关卡的通关条件，接收一个player为参数
    */
    public abstract customsClearance(player: Player): boolean

    /**
    * 返回一个zodSchema，这有助于模组开发
    * 这样json解析器不需要管这是一个什么Condition类，只需要根据类提供的schema验证就行
    */
    public static getSchema() {
        throw new Error('子类必须提供自身的schema用于校验')
    }
}
