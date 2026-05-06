import Player from "../../world/Player.js";
import LevelCondition from "../registry/LevelCondition.js";
import z from 'zod'

export const GeneralPurposeScheme = z.object({
    prop: z.string(),
    num: z.number(),
    cat: z.enum(['lessThan', 'greaterThan'])
})




export default class GeneralPurpose extends LevelCondition {
    public prop: string
    public num: number
    public cat: 'lessThan' | 'greaterThan'

    constructor({ prop, num, cat }: z.infer<typeof GeneralPurposeScheme>) {
        super()
        this.prop = prop
        this.num = num
        this.cat = cat
    }

    private isKeyOfPlayer(key: string): key is keyof Player {
        const keys: string[] = ["age", "health", "height", "weight", "angerValue", "excitationValue", "depressionValue", "weakValue", "fortune"]
        return keys.includes(key)
    }

    public customsClearance(player: Player): boolean {
        if (!this.isKeyOfPlayer(this.prop)) {
            throw new Error(`key ${this.prop} 不存在`)
        }

        const value = player[this.prop];

        if (typeof value === 'number') {
            switch (this.cat) {
                case 'lessThan': return value < this.num;
                case 'greaterThan': return value > this.num;
                default: return value === this.num;
            }
        }

        return false;
    }


    public static getSchema() {
        return GeneralPurposeScheme
    };
}
