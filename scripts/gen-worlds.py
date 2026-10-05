# -*- coding: utf-8 -*-
"""Hand-authored content generator for TerminalLive worlds.
Writes resource/worlds/<id>/{world.json, events/, npcs/, chronicle/, pressures/, rules/, language/}
and purges stale world keys from the global language packs."""
import json, os, glob

LANGS = ["en_US", "zh_CN", "ja_JP", "ru_RU"]
def L(en, zh, ja, ru): return {"en_US": en, "zh_CN": zh, "ja_JP": ja, "ru_RU": ru}
def role(r): return "npc.role." + r

BANDS = {"child": "3-12", "youth": "13-29", "adult": "30-59", "elder": "60-100", "any": "3-100"}

def eff(sign, tag):
    base = {
        "++": {"happiness": 6, "reputation": 5, "health": 3},
        "+":  {"happiness": 4, "reputation": 2},
        "-":  {"happiness": -4, "health": -2},
        "--": {"happiness": -6, "health": -6, "money": -25},
    }[sign]
    d = dict(base)
    if tag == "challenge": d["health"] = d.get("health", 0) - 3
    if tag == "boon": d["money"] = d.get("money", 0) + 15
    if tag == "scheme": d["angerValue"] = d.get("angerValue", 0) + 4
    if tag == "economy": d["money"] = d.get("money", 0) + (40 if sign in ("+", "++") else -30)
    return d

# ---- archetypes: id, band, tag, weight, title{L}, frame{L}, choices[(id,label{L},sign)] ----
ARCH = []
def A(aid, band, tag, title, frame, choices, w=1.0, cat=None, once=False, extra=None):
    ARCH.append(dict(id=aid, band=band, tag=tag, title=title, frame=frame,
                     choices=choices, w=w, cat=cat, once=once, extra=extra or {}))

A("stranger","any","social",
  L("A Stranger","陌生的来客","旅人","Незнакомец"),
  L("A traveller from {place} brings word of {flavor}.","来自{place}的旅人带来了{flavor}的消息。","{place}からの旅人が{flavor}の知らせを運ぶ。","Странник из {place} приносит весть о {flavor}."),
  [("listen",L("Hear them out","听他说完","最後まで聞く","Выслушать"),"+"),
   ("turn",L("Send them away","打发他走","追い払う","Прогнать"),"-")])
A("theft","any","challenge",
  L("Thieves","窃贼","盗賊","Воры"),
  L("Thieves strike at {place} while {flavor} runs its course.","{place}的盗贼趁{flavor}之际下手。","{flavor}のさなか、{place}で盗賊が襲う。","Воры бьют у {place}, пока идёт {flavor}."),
  [("chase",L("Give chase","追赶","追いかける","Погнаться"),"+"),
   ("yield",L("Let it go","就此作罢","諦める","Отпустить"),"-")])
A("illness","any","challenge",
  L("Fever","热病","熱病","Лихорадка"),
  L("A fever spreads through {place} with {flavor} at the door.","热病在{place}蔓延，{flavor}已到门口。","熱病が{place}に広がり、{flavor}が迫る。","Жар ползёт по {place}, у дверей {flavor}."),
  [("nurse",L("Nurse the sick","照料病人","病人を看る","Ухаживать за больными"),"+"),
   ("avoid",L("Keep away","远远避开","遠ざかる","Держаться подальше"),"-")], cat="health")
A("windfall","adult","boon",
  L("Windfall","横财","思いがけぬ利益","Ветры удачи"),
  L("Fortune smiles: {flavor} pays off at {place}.","时来运转：{flavor}在{place}有了回报。","{place}で{flavor}が報い、幸運が訪れる。","Удача: {flavor} окупается у {place}."),
  [("invest",L("Reinvest it","再投进去","再投資する","Вложить снова"),"++"),
   ("save",L("Bank it quietly","悄悄存起来","静かに貯める","Тихо отложить"),"+")], cat="money")
A("betrayal","adult","scheme",
  L("A Trusted Hand","信任之手","信じた手","Верная рука"),
  L("A trusted hand turns on you amid {flavor} at {place}.","在{place}的{flavor}之中，一只信任的手背叛了你。","{place}の{flavor}の中で、信じた手が裏切る。","Верная рука предаёт при {flavor} у {place}."),
  [("confront",L("Confront them","当面对质","問い詰める","Выяснить"),"-"),
   ("plan",L("Bide your time","伺机而动","機を待つ","Выждать"),"++")], cat="intrigue")
A("festival","any","boon",
  L("Festival","庆典","祭り","Праздник"),
  L("{place} holds a festival despite {flavor}.","尽管有{flavor}，{place}仍举办庆典。","{flavor}にもかかわらず、{place}は祭りを開く。","У {place} праздник назло {flavor}."),
  [("join",L("Join the joy","一起欢庆","喜びに加わる","Присоединиться"),"+"),
   ("work",L("Work through it","照常干活","働き続ける","Работать"),"-")], cat="social")
A("rumor","any","rumor",
  L("A Rumour","流言","噂","Слух"),
  L("A rumour about you spreads from {place}, stoked by {flavor}.","关于你的流言从{place}传出，被{flavor}添油加醋。","あなたの噂が{place}から広がる、{flavor}に煽られて。","Слух о тебе идёт из {place}, раздутый {flavor}."),
  [("trace",L("Hunt its source","追查源头","出所を探る","Найти источник"),"+"),
   ("ignore",L("Let it burn out","任其自灭","放っておく","Дать угаснуть"),"-")], cat="intrigue")
A("journey","youth","explore",
  L("The Open Road","旷野之路","開かれた道","Открытая дорога"),
  L("A road opens past {place} through {flavor}.","一条路穿过{place}，通往{flavor}。","{place}を越えて{flavor}へ道が開く。","Дорога уходит за {place} сквозь {flavor}."),
  [("go",L("Take the road","上路","旅立つ","Отправиться"),"++"),
   ("stay",L("Stay put","留在原地","留まる","Остаться"),"+")], cat="explore")
A("duel","adult","challenge",
  L("A Challenge","决斗","挑戦","Вызов"),
  L("A rival challenges you before all of {place} in {flavor}.","对手当着{place}众人的面向你挑战，正值{flavor}。","好敵手が{place}の前で挑む、{flavor}のなか。","Соперник бросает вызов при всём {place} под {flavor}."),
  [("fight",L("Accept the duel","应战","受けて立つ","Принять вызов"),"++"),
   ("decline",L("Refuse with grace","体面地拒绝","礼を尽くして断る","Отказаться с честью"),"-")], cat="combat")
A("harvest","any","nature",
  L("The Harvest","收成","収穫","Урожай"),
  L("{flavor} decides the harvest around {place}.","{flavor}决定了{place}一带的收成。","{flavor}が{place}周辺の実りを決める。","{flavor} решает урожай близ {place}."),
  [("share",L("Share the surplus","分享余粮","余りを分ける","Поделиться"),"++"),
   ("hoard",L("Hoard it","囤积起来","蓄える","Запасти"),"-")], cat="nature")
A("law","adult","order",
  L("New Law","新法","新たな法","Новый закон"),
  L("A new law sweeps {place} alongside {flavor}.","新法令随{flavor}席卷{place}。","新たな法が{flavor}とともに{place}を覆う。","Новый закон катится по {place} с {flavor}."),
  [("obey",L("Comply","遵命","従う","Подчиниться"),"+"),
   ("defy",L("Defy it","抗命","逆らう","Ослушаться"),"++")], cat="order")
A("first_love","youth","romance",
  L("First Love","初恋","初恋","Первая любовь"),
  L("You meet someone kind at {place} during {flavor}.","{flavor}之时，你在{place}遇见一个善良的人。","{flavor}のさなか、{place}で優しい人に出会う。","В {place} среди {flavor} ты встречаешь доброго человека."),
  [("woo",L("Court them","追求","口説く","Ухаживать"),"++"),
   ("friend",L("Stay friends","只做朋友","友達でいる","Остаться друзьями"),"+")], cat="romance")
A("grief","any","loss",
  L("A Passing","逝去","訃報","Утрата"),
  L("Death visits {place}, carried on {flavor}.","死亡随{flavor}造访了{place}。","{flavor}に乗って死が{place}を訪れる。","Смерть приходит в {place} на {flavor}."),
  [("mourn",L("Sit in mourning","守丧","喪に服す","Скорбеть"),"-"),
   ("carry",L("Carry on","继续前行","前に進む","Идти дальше"),"+")], cat="loss")
A("craft","adult","work",
  L("Work Calls","活计","仕事の誘い","Работа"),
  L("Work calls at {place} through {flavor}.","{flavor}期间，{place}有一份活计找上门。","{flavor}のさなか、{place}で仕事の誘いが来る。","Работа зовёт в {place} сквозь {flavor}."),
  [("take",L("Take the work","接下","引き受ける","Взяться"),"+"),
   ("refuse",L("Turn it down","推掉","断る","Отказаться"),"-")], cat="work")
A("secret","adult","mystery",
  L("A Secret","秘密","秘密","Тайна"),
  L("{place} hides a secret beneath {flavor}.","{place}在{flavor}之下藏着一个秘密。","{place}は{flavor}の下に秘密を隠す。","{place} прячет тайну под {flavor}."),
  [("open",L("Open it","揭开它","暴く","Раскрыть"),"++"),
   ("leave",L("Leave it sealed","让它尘封","封じたまま","Оставить закрытым"),"-")], cat="mystery")
A("drought","any","scarcity",
  L("Drought","干旱","旱魃","Засуха"),
  L("{flavor} dries the wells around {place}.","{flavor}使{place}的水井干涸。","{flavor}が{place}の井戸を乾かす。","{flavor} сушит колодцы у {place}."),
  [("ration",L("Ration carefully","精打细算","配分する","Экономить"),"+"),
   ("take",L("Take by force","强行夺取","力ずくで奪う","Забрать силой"),"-")], cat="scarcity")
A("gift","any","comfort",
  L("A Small Kindness","小小善意","小さな親切","Малая доброта"),
  L("A small kindness reaches you at {place} amid {flavor}.","{flavor}之中，{place}的一份小小善意传到你这儿。","{flavor}のなか、{place}から小さな親切が届く。","Маленькая доброта доходит до тебя в {place} среди {flavor}."),
  [("accept",L("Accept warmly","欣然接受","素直に受ける","Принять тепло"),"++"),
   ("suspect",L("Suspect a trap","怀疑有诈","罠を疑う","Заподозрить ловушку"),"-")], cat="comfort")
A("war","adult","challenge",
  L("War","战事","戦","Война"),
  L("War rolls over {place}, born of {flavor}.","战争碾过{place}，由{flavor}而起。","戦が{place}を呑み込む、{flavor}ゆえに。","Война катится по {place}, рождённая {flavor}."),
  [("serve",L("Serve","参军","仕える","Служить"),"++"),
   ("hide",L("Hide your family","藏起家人","家族を隠す","Спрятать семью"),"+")], cat="war")
A("famine","any","challenge",
  L("Hunger","饥荒","飢え","Голод"),
  L("Hunger follows {flavor} into {place}.","饥饿随{flavor}蔓延进{place}。","飢えが{flavor}とともに{place}へ入る。","Голод идёт за {flavor} в {place}."),
  [("share",L("Share what you have","分出口粮","分け与える","Поделиться"),"++"),
   ("close",L("Shut the door","关上门","戸を閉ざす","Запереться"),"-")], cat="scarcity")
A("tradition","elder","order",
  L("Old Rites","旧礼","古き儀式","Древние обряды"),
  L("Old rites return to {place} under {flavor}.","旧礼节在{flavor}之下重回{place}。","古き儀式が{flavor}のもと{place}へ戻る。","Древние обряды возвращаются в {place} под {flavor}."),
  [("keep",L("Keep the rite","遵循旧礼","儀を守る","Соблюсти обряд"),"+"),
   ("break",L("Break with it","打破陈规","破る","Порушить"),"++")], cat="order")
A("legacy","elder","family",
  L("Legacy","传承","遺産","Наследие"),
  L("You ponder what you leave to those of {place} in {flavor}.","在{flavor}中，你思量要给{place}的后来者留下什么。","{flavor}のなか、{place}の後世に何を遺すか思う。","Ты думаешь, что оставить {place} под {flavor}."),
  [("write",L("Write it down","写下","書き残す","Записать"),"++"),
   ("silent",L("Say nothing","沉默","何も言わぬ","Промолчать"),"-")], cat="family")
A("temptation","adult","vice",
  L("Temptation","诱惑","誘惑","Соблазн"),
  L("Temptation waits at {place} beneath {flavor}.","诱惑在{flavor}之下的{place}等着你。","誘惑が{flavor}の下、{place}で待つ。","Соблазн ждёт в {place} под {flavor}."),
  [("resist",L("Resist","抗拒","抗う","Устоять"),"++"),
   ("yield",L("Give in","屈服","屈する","Поддаться"),"--")], cat="vice")
A("rescue","any","boon",
  L("A Rescue","施救","救出","Спасение"),
  L("Someone needs rescuing at {place} as {flavor} closes in.","{flavor}逼近时，{place}有人急需相救。","{flavor}が迫る中、{place}で誰かが救いを求める。","Кого-то надо спасти у {place}, пока {flavor} сжимается."),
  [("help",L("Rush to help","赶去相助","助けに向かう","Броситься на помощь"),"++"),
   ("pass",L("Walk on","漠然走过","通り過ぎる","Пройти мимо"),"-")], cat="boon")
A("bargain","adult","economy",
  L("A Bargain","买卖","取引","Сделка"),
  L("A bargain is offered at {place} through {flavor}.","{flavor}期间，{place}有一桩买卖。","{flavor}のさなか、{place}で取引の話。","Сделку предлагают в {place} сквозь {flavor}."),
  [("deal",L("Strike the deal","成交","契約する","Заключить сделку"),"++"),
   ("walk",L("Walk away","走开","立ち去る","Уйти"),"-")], cat="economy")
A("storm_night","any","nature",
  L("The Storm","风暴","嵐","Буря"),
  L("A storm batters {place} while {flavor} holds.","风暴拍打{place}，{flavor}仍在。","嵐が{place}を打つ、{flavor}のまま。","Буря хлещет {place}, пока держится {flavor}."),
  [("shelter",L("Shelter the weak","庇护弱者","弱きを庇う","Укрыть слабых"),"++"),
   ("self",L("Save yourself","只顾自己","我が身を守る","Спасать себя"),"-")], cat="nature")
A("scholarship","youth","study",
  L("Learning","求学","学び","Учение"),
  L("Learning beckons at {place} during {flavor}.","{flavor}之时，{place}的学问在召唤。","{flavor}のさなか、{place}で学びが招く。","Учение манит в {place} среди {flavor}."),
  [("study",L("Study hard","刻苦攻读","学に励む","Усердно учиться"),"++"),
   ("play",L("Slack off","偷懒","怠ける","Полениться"),"-")], cat="study")
A("honor","adult","order",
  L("An Honour","荣誉","名誉","Почёт"),
  L("An honour is offered at {place} despite {flavor}.","尽管有{flavor}，{place}仍给了你一份荣誉。","{flavor}にもかかわらず、{place}で名誉が授けられる。","В {place} предлагают почёт, невзирая на {flavor}."),
  [("accept",L("Accept it humbly","谦逊受之","謙虚に受ける","Принять скромно"),"++"),
   ("decline",L("Decline it","谢绝","辞退する","Отказаться"),"+")], cat="order")
A("lost","child","family",
  L("Lost","迷路","迷子","Заблудился"),
  L("You lose your way near {place} amid {flavor}.","{flavor}之中，你在{place}附近迷了路。","{flavor}のさなか、{place}の近くで道に迷う。","Ты теряешь дорогу у {place} среди {flavor}."),
  [("call",L("Call for help","大声呼救","助けを呼ぶ","Звать на помощь"),"+"),
   ("wait",L("Be brave, wait","勇敢等待","待つ、勇敢に","Ждать, быть смелым"),"++")], cat="family")
A("dream","child","comfort",
  L("A Dream","梦境","夢","Сон"),
  L("A strange dream visits you at {place} through {flavor}.","{flavor}里，一个奇梦在{place}造访你。","{flavor}のなか、{place}で奇妙な夢を見る。","Странный сон приходит в {place} сквозь {flavor}."),
  [("follow",L("Follow the dream","追随梦境","夢を追う","Следовать сну"),"+"),
   ("wake",L("Wake and forget","醒来忘掉","目覚めて忘れる","Проснуться и забыть"),"-")], cat="comfort")
A("bet","adult","vice",
  L("A Wager","赌局","賭け","Ставка"),
  L("A wager is laid against you at {place} amid {flavor}.","{place}的{flavor}中，有人拿你下了注。","{place}の{flavor}のなか、あなたに賭けが張られる。","Против тебя ставят у {place} среди {flavor}."),
  [("match",L("Match the stake","加注","張り合う","Поднять ставку"),"--"),
   ("fold",L("Fold early","早早抽身","早々に降りる","Спасовать"),"+")], cat="vice")
A("hermit","elder","wisdom",
  L("A Hermit","隐者","隠者","Отшельник"),
  L("A hermit in {place} shares wisdom under {flavor}.","{place}的隐者在{flavor}之下分享智慧。","{place}の隠者が{flavor}のもと知恵を授ける。","Отшельник в {place} делится мудростью под {flavor}."),
  [("learn",L("Sit and learn","坐下受教","座して学ぶ","Сесть и учиться"),"++"),
   ("mock",L("Mock and leave","嘲笑后离开","嘲笑して去る","Язвить и уйти"),"-")], cat="wisdom")

# ---- per-world data ----
def W(id, icon, tags, rules, unlock, complete, start, climate, name, desc, places, flavors, npcs, eras, facs, regs, theme):
    return dict(id=id, icon=icon, tags=tags, rules=rules, unlock=unlock, complete=complete,
                start=start, climate=climate, name=name, desc=desc, places=places, flavors=flavors,
                npcs=npcs, eras=eras, facs=facs, regs=regs, theme=theme)

WORLDS = [
 W("hellscape","🔥",["harsh"],["rule_hostile"],["wasteland","paranoia"],70,
   {"age":0,"health":90,"happiness":40,"fitness":14,"intelligence":8,"social":6,"money":0},"arid",
   L("Hellscape","炼狱","地獄","Преисподняя"),
   L("A world of ash and iron. Everything here wants you dead — endure, or be forgotten.",
     "灰烬与钢铁的世界。这里的一切都想要你的命——要么熬过去，要么被遗忘。",
     "灰と鉄の世界。ここではすべてがあなたの死を望む——耐えるか、忘れられるかだ。",
     "Мир пепла и железа. Всё здесь желает вам смерти — выживите или каньте в небытие."),
   L(["the Iron Pit","the Ashen Walk","Brimstone Ridge","the Screaming Gate","the Bone Yard","the Drowned Forge",
      "the Salt Caves","Cinder Town","the Rope Bridge","the Black Chapel","the Slave Pens","the Ember Fields"],
     ["铁坑","灰烬走廊","硫磺山脊","哀嚎之门","白骨场","沉没锻炉","盐窟","煤渣镇","绳桥","黑礼拜堂","奴工营","余烬旷野"],
     ["鉄の穴","灰の道","硫黄の尾根","叫びの門","骨の庭","沈んだ炉","塩の洞","燃え殻の町","綱の橋","黒い礼拝堂","奴隸の檻","燠の野"],
     ["Железная яма","Пепельная тропа","Серный хребет","Врата крика","Костяной двор","Затонувшая кузня","Соляные пещеры","Шлаковый город","Канатный мост","Чёрная часовня","Невольничьи ямы","Угольные поля"]),
   L(["the long slaughter","the ash tide","the iron levy","the broken oaths","the ceaseless fire","the grey hunger",
      "the tithe of blood","the silent bells","the iron winter","the last prayer"],
     ["漫长的屠杀","灰潮","铁税","破碎的誓言","不灭之火","灰色的饥荒","血之十一税","沉默的钟","铁冬","最后的祈祷"],
     ["長き殺戮","灰の潮","鉄の徴税","破られた誓い","絶えぬ火","灰色の飢え","血の十分の一","沈黙の鐘","鉄の冬","最後の祈り"],
     ["долгая резня","пепельный прилив","железная подать","нарушенные клятвы","неугасимый огонь","серая нужда","кровавая десятина","молчащие колокола","железная зима","последняя молитва"]),
   [["Ash-Mother","灰母","灰の母","Мать пепла"],["Gruk the Tyrant","暴君格鲁克","暴君グルク","Тиран Грук"],["Bellows","风箱","ふいご","Мех"],
    ["Old Scratch","老鬼","老いた悪魔","Старый Скрэтч"],["Marrow","骨髓","骨髄","Мозг"],["Soot","煤烟","煤","Сажа"],
    ["Vex","维克丝","ヴェクス","Векс"],["the Forge-Widow","锻炉寡妇","炉の寡婦","Вдова кузни"],["Cinder","燠","燠","Уголёк"],
    ["the Skald","吟游者","吟遊詩人","Скальд"]],
   L(["Brimstone Age","Ash Reign","Iron Call","Cinderfall","Ember Dust","Dark Cooling"],
     ["硫磺时代","灰烬统治","铁之召唤","余烬坠落","烬尘","暗冷"],
     ["硫黄の時代","灰の統治","鉄の召喚","燠の降下","燠の塵","暗き冷却"],
     ["Эпоха серы","Правление пепла","Железный зов","Падение углей","Угольная пыль","Тёмное остывание"]),
   L(["The Legion","The Forsaken","The Chains","The Ember Court","The Ashen Choir"],
     ["军团","被弃者","锁链","余烬宫廷","灰烬唱诗班"],
     ["軍団","見捨てられし者","鎖","燠の宮廷","灰の聖歌隊"],
     ["Легион","Отверженные","Цепи","Угольный двор","Пепельный хор"]),
   L(["The Pit","Ashen Walk","Iron Ridge","Bone Yard","Salt Flats","Cinder Town","Drowned Forge"],
     ["深坑","灰烬走廊","铁脊","白骨场","盐滩","煤渣镇","沉没锻炉"],
     ["穴","灰の道","鉄の尾根","骨の庭","塩の平地","燃え殻の町","沈んだ炉"],
     ["Яма","Пепельная тропа","Железный хребет","Костяной двор","Соляные равнины","Шлаковый город","Затонувшая кузня"]),
   L("ash","灰烬","灰","пепел")),
 W("paranoia","👁",["intrigue"],["rule_paranoid"],["neon_city","plague_years"],80,
   {"age":0,"health":95,"happiness":55,"intelligence":12,"social":10,"fitness":8,"money":50},"temperate",
   L("The Watchful","瞩目之域","監視の国","Надзор"),
   L("Everyone smiles, everyone informs. Trust no one; survive in the gaps.",
     "人人微笑，人人告密。别信任何人，在缝隙里活下去。",
     "誰もが笑い、誰もが密告する。誰も信じず、隙間で生き延びろ。",
     "Все улыбаются, все доносят. Не верь никому — выживай в щелях."),
   L(["the Central Hub","Sublevel Nine","the Cold Docks","the Listening Room","the Grey Office","the Night Market",
      "the Quiet Ward","Transit Line Four","the Archive","the Roofs","the Re-education Hall","the Canteen"],
     ["中央枢纽","地下九层","冷码头","监听室","灰办公室","夜市","静默病房","四号线","档案馆","屋顶","再教育厅","食堂"],
     ["中央ハブ","地下九層","冷たい波止場","聴聞室","灰色の事務所","夜市","静かな病棟","四号線","書庫","屋根","再教育ホール","食堂"],
     ["Центральный узел","Подземный ярус девять","Холодные доки","Комната прослушки","Серый офис","Ночной рынок","Тихая палата","Четвёртая линия","Архив","Крыши","Зал перевоспитания","Столовая"]),
   L(["the loyalty drive","the quiet purges","the wire taps","the informer's bonus","the sealed orders","the missing neighbours",
      "the curfew","the ration cuts","the doubled agents","the final audit"],
     ["忠诚运动","静默清洗","窃听布线","告密奖金","密令","失踪的邻居","宵禁","配给削减","双面间谍","最终审计"],
     ["忠誠運動","静かな粛清","盗聴","密告の報奨","封印命令","消えた隣人","門限","配給削減","二重スパイ","最終監査"],
     ["кампания верности","тихие чистки","прослушки","награда доносчику","запечатанные приказы","пропавшие соседи","комендантский час","урезание пайка","двойные агенты","последняя ревизия"]),
   [["Mother","母","母","Мать"],["Handler Voss","沃斯","ヴォス","Восс"],["Weasel","黄鼠狼","イタチ","Хорёк"],["Bright","亮子","アカルイ","Светлана"],
      ["Clerk Dane","戴恩","デイン","Дейн"],["the Neighbour","邻居","隣人","Сосед"],["Little Pim","小皮姆","小ピム","Пим"],
      ["the Auditor","审计员","監査官","Ревизор"],["Songbird","告密歌手","密告の歌姫","Певунья"],["the Doorman","门卫","門番","Привратник"]],
   L(["Wire Age","Glass State","The Purge","Quiet Rule","The Audit","Silent Freeze"],
     ["线路时代","玻璃国度","大清洗","静默统治","大审计","沉寂之冬"],
     ["電線の時代","硝子の国","大粛清","静かな統治","大監査","沈黙の冬"],
     ["Эпоха провода","Стеклянное государство","Чистка","Тихое правление","Ревизия","Тихая зима"]),
   L(["The Bureau","The Cells","The Watchers","The Nameless","The Choir of Keys"],
     ["局","小组","监视者","无名者","钥匙唱诗班"],
     ["局","細胞","監視者","名もなき者","鍵の聖歌隊"],
     ["Бюро","Ячейки","Наблюдатели","Безымянные","Хор ключей"]),
   L(["Central Hub","Sublevels","Cold Docks","Night Market","Quiet Ward","The Roofs","The Archive"],
     ["中央枢纽","地下层","冷码头","夜市","静默病房","屋顶","档案馆"],
     ["中央ハブ","地下層","冷たい波止場","夜市","静かな病棟","屋根","書庫"],
     ["Центральный узел","Подземелья","Холодные доки","Ночной рынок","Тихая палата","Крыши","Архив"]),
   L("watch","窥视","監視","надзор")),
 W("golden_age","🎨",["gentle"],["rule_idyllic"],["classic"],100,
   {"age":0,"health":100,"happiness":80,"intelligence":10,"social":10,"fitness":10,"money":100},"temperate",
   L("Golden Age","黄金时代","黄金時代","Золотой век"),
   L("A bright, generous world. Make art, make friends, make a life worth remembering.",
     "明亮慷慨的世界。去创作、去交友，去过值得铭记的一生。",
     "明るく寛大な世界。芸術をなし、友を作り、記憶に値する人生を。",
     "Светлый, щедрый мир. Твори, дружи и проживи жизнь, достойную памяти."),
   L(["the Great Gallery","the Cider Hills","the Long Shore","the Muses' Court","the Orchard","the Open Theatre",
      "the Glass Atrium","the Painter's Quarter","the Singing Fountain","the Old Library","the Flower Market","the Sunset Pier"],
     ["大画廊","苹果酒山","长岸","缪斯庭院","果园","露天剧场","玻璃中庭","画匠街区","歌唱喷泉","老图书馆","花市","落日码头"],
     ["大画廊","林檎酒の丘","長き岸","ミューズの中庭","果樹園","野外劇場","硝子の中庭","画家の街区","歌う噴水","古い図書館","花市","夕暮れの桟橋"],
     ["Великая галерея","Сидровые холмы","Долгий берег","Двор муз","Сад","Открытый театр","Стеклянный атриум","Квартал живописцев","Поющий фонтан","Старая библиотека","Цветочный рынок","Закатный пирс"]),
   L(["the festival of colours","the patron's contest","the harvest of plenty","the summer of song","the great unveiling","the season of gifts",
      "the year of wonders","the long picnic","the masque","the comet's visit"],
     ["色彩之节","赞助人竞赛","丰饶之收","歌唱之夏","盛大揭幕","馈赠之季","奇迹之年","悠长野餐","假面舞会","彗星来访"],
     ["色彩の祭り","後援者の競技","豊穣の収穫","歌の夏","大いなる除幕","贈り物の季節","驚異の年","長いピクニック","仮面舞踏会","彗星の訪れ"],
     ["праздник красок","соперничество меценатов","урожай изобилия","лето песни","великое открытие","сезон даров","год чудес","долгий пикник","маскарад","визит кометы"]),
   [["Papa","爸爸","パパ","Папа"],["Lady Aurelia","奥蕾莉娅夫人","オーレリア夫人","Леди Аврелия"],["Robin","罗宾","ロビン","Робин"],["Cassio","卡西奥","カッシオ","Кассио"],
      ["Maestro Lio","利奥大师","リオ師","Маэстро Лио"],["Nell","奈尔","ネル","Нелл"],["the Twins","双胞胎","双子","Близнецы"],
      ["Old Vesper","晚祷老人","老ヴェスパー","Старый Веспер"],["Muse","缪斯","ミューズ","Муза"],["the Patron","赞助人","後援者","Меценат"]],
   L(["Dawn of Art","Age of Patrons","Age of Legends","Age of Flourishing","Age of Masterworks","Eternal Summer"],
     ["艺术黎明","赞助时代","传奇时代","繁盛时代","杰作时代","永恒之夏"],
     ["芸術の黎明","後援の時代","伝説の時代","繁栄の時代","傑作の時代","永遠の夏"],
     ["Рассвет искусства","Эпоха меценатов","Эпоха легенд","Эпоха расцвета","Эпоха шедевров","Вечное лето"]),
   L(["The Guild","The Gallery","The Free Painters","The Chorus","The Patrons"],
     ["行会","画廊","自由画师","合唱团","赞助人"],
     ["ギルド","画廊","自由画家","合唱団","後援者"],
     ["Гильдия","Галерея","Свободные художники","Хор","Меценаты"]),
   L(["The Garden","Cider Hill","Bright Shore","Muses' Court","Glass Atrium","Flower Market","Sunset Pier"],
     ["花园","苹果酒山","明亮海岸","缪斯庭院","玻璃中庭","花市","落日码头"],
     ["庭園","林檎酒の丘","明るい岸","ミューズの中庭","硝子の中庭","花市","夕暮れの桟橋"],
     ["Сад","Сидровый холм","Светлый берег","Двор муз","Стеклянный атриум","Цветочный рынок","Закатный пирс"]),
   L("muse","缪斯","ミューズ","муза")),
 W("plague_years","☠",["harsh"],["rule_plague"],["neon_city"],75,
   {"age":0,"health":85,"happiness":55,"fitness":9,"intelligence":11,"social":8,"money":30},"temperate",
   L("Plague Years","瘟疫年代","疫病の時代","Годы чумы"),
   L("Sickness walks beside you. Keep others alive and you keep yourself alive.",
     "疾病与你同行。让别人活着，你才能活着。",
     "病は隣を歩く。誰かを生かすことが、自分を生かす。",
     "Болезнь идёт рядом. Спасая других, спасаешь себя."),
   L(["the Quarantine Ward","Empty Street","the Burning Fields","the Plague Pit","the Physician's Hall","the Grey Market",
      "the Chapel of Bells","the Water Cart","the Boarded House","the Mourning Road","the Herb Garden","the Old Infirmary"],
     ["隔离病房","空街","燃烧的田野","瘟疫坑","医师厅","灰市","钟声礼拜堂","水车","封板屋","送葬路","药草园","老医务所"],
     ["隔離病棟","空の街","燃える畑","疫病の穴","医師の広間","灰色市場","鐘の礼拝堂","水車","板張りの家","喪の道","薬草園","古い施療院"],
     ["Карантинная палата","Пустая улица","Горящие поля","Чумная яма","Зал лекарей","Серый рынок","Часовня колоколов","Водовоз","Забитый дом","Траурная дорога","Травяной сад","Старый лазарет"]),
   L(["the first outbreak","the burning of the dead","the closed gates","the flight of the rich","the quarantine decree","the night carts",
      "the shortage of herbs","the mourning bells","the false cure","the slow recovery"],
     ["首次爆发","焚烧死者","城门封闭","富人出逃","隔离令","夜车","药草短缺","丧钟","假药","缓慢复苏"],
     ["最初の発生","死者の焚火","閉ざされた門","富者の逃亡","隔離令","夜の荷車","薬草の不足","弔いの鐘","偽りの薬","緩やかな回復"],
     ["первая вспышка","сожжение мёртвых","закрытые ворота","бегство богатых","указ о карантине","ночные телеги","нехватка трав","погребальные колокола","ложное лекарство","медленное исцеление"]),
   [["Mama Olu","奥卢妈妈","オル母","Мама Олу"],["Doctor Hale","黑尔医生","ヘイル医師","Доктор Хейл"],["Mute Jonas","哑巴乔纳斯","無口のジョナス","Немой Йонас"],["Ration Louis","口粮路易","配給のルイ","Паёк Луи"],
      ["Sister Agnes","阿格尼丝修女","アグネス修道女","Сестра Агнес"],["the Cart Man","收尸人","荷車屋","Возчик"],["Little Pip","小皮普","小ピップ","Пип"],
      ["Widow Grey","灰寡妇","灰色の寡婦","Вдова Грей"],["the Herb-Witch","草药巫","薬草の魔女","Ведьма-травница"],["the Bell-Ringer","敲钟人","鐘つき","Звонарь"]],
   L(["Before","The Outbreak","The Long Fever","Recovery","Aftermath","The Quiet Years"],
     ["之前","爆发","长热","康复","余波","静默岁月"],
     ["以前","発生","長き熱","回復","余波","静かな歳月"],
     ["До","Вспышка","Долгий жар","Выздоровление","Последствия","Тихие годы"]),
   L(["The Physicians","The Mourners","The Gravediggers","The Merchants","The Bells"],
     ["医师","哀悼者","掘墓人","商人","钟"],
     ["医師","弔う者","墓掘り","商人","鐘"],
     ["Лекари","Плакальщики","Могильщики","Торговцы","Колокола"]),
   L(["Quarantine Ward","Empty Street","Burning Fields","Plague Pit","Herb Garden","Mourning Road","Old Infirmary"],
     ["隔离病房","空街","燃烧的田野","瘟疫坑","药草园","送葬路","老医务所"],
     ["隔離病棟","空の街","燃える畑","疫病の穴","薬草園","喪の道","古い施療院"],
     ["Карантинная палата","Пустая улица","Горящие поля","Чумная яма","Травяной сад","Траурная дорога","Старый лазарет"]),
   L("plague","瘟疫","疫病","чума")),
 W("wasteland","🏜",["harsh","wild"],["rule_wasteland"],["wilds"],80,
   {"age":0,"health":95,"happiness":50,"fitness":13,"intelligence":9,"social":7,"money":0},"arid",
   L("Wasteland","废土","荒れ地","Пустошь"),
   L("Water is money and metal is law. Every scrap you find, someone wants.",
     "水即钱，铁即法。你捡到的每一块废料，都有人想要。",
     "水は金、鉄は法。拾ったがらくたを、誰かが欲しがる。",
     "Вода — деньги, металл — закон. На каждый лом найдётся охотник."),
   L(["the Oasis","Bone Ruins","the Glass Dunes","the Rust Market","the Water Works","the Wreck of the Meridian",
      "the Salt Road","the Solar Farm","the Pit Stop","the Old Highway","the Scrap Spire","the Dry Lake"],
     ["绿洲","白骨废墟","玻璃沙丘","锈市","水厂","子午线残骸","盐路","太阳能农场","补给站","旧公路","废料尖塔","干涸湖"],
     ["オアシス","骨の廃墟","硝子の砂丘","錆の市場","水道施設","子午線の残骸","塩の道","太陽農場","停車場","旧街道","屑鉄の尖塔","涸れた湖"],
     ["Оазис","Костяные руины","Стеклянные дюны","Ржавый рынок","Водоканал","Обломок «Меридиана»","Соляная дорога","Солнечная ферма","Привал","Старое шоссе","Шлаковая игла","Сухое озеро"]),
   L(["the great drought","the water wars","the caravan season","the storm of glass","the rust fever","the fuel shortage",
      "the raider moon","the long trek","the buried cache","the quiet truce"],
     ["大旱","水战","商队季","玻璃风暴","锈热病","燃料短缺","劫掠之月","漫长跋涉","埋藏的储备","静默停战"],
     ["大旱魃","水の戦い","隊商の季節","硝子の嵐","錆の熱","燃料不足","略奪の月","長き旅","埋もれた備蓄","静かな休戦"],
     ["великая засуха","водяные войны","сезон караванов","стеклянная буря","ржавая лихорадка","нехватка топлива","луна налётчиков","долгий переход","зарытый склад","тихое перемирие"]),
   [["Sable","赛布尔","セーブル","Соболь"],["Cog","齿轮","コグ","Шестерня"],["Rust","锈牙","ラスト","Раст"],["Mother Price","普莱斯婆婆","プライス婆","Госпожа Прайс"],
      ["Dust","尘土","ダスト","Пыль"],["Vera","薇拉","ヴェラ","Вера"],["the Boy","男孩","少年","Мальчик"],
      ["Ash","灰烬","灰","Эш"],["the Trader","商人","商人","Торговец"],["the Well-Keeper","井守","井戸守","Хранитель колодца"]],
   L(["The Fall","Scrap Age","Slow Rebirth","The Long Drought","The Caravan Years","Green Stirring"],
     ["坠落","废料时代","缓慢重生","长旱","商队岁月","绿意初动"],
     ["崩落","屑鉄の時代","緩やかな再生","長き旱魃","隊商の歳月","緑の兆し"],
     ["Падение","Эпоха лома","Медленное возрождение","Долгая засуха","Годы караванов","Зелёный рубец"]),
   L(["Water Conclave","The Raiders","The Caravans","The Fixers","The Well-Keepers"],
     ["水之会议","掠夺者","商队","修理工","井守"],
     ["水の会議","略奪者","隊商","修理屋","井戸守"],
     ["Водный конклав","Налётчики","Караваны","Механики","Хранители колодцев"]),
   L(["The Oasis","Bone Ruins","Glass Dunes","Rust Market","Salt Road","Dry Lake","Old Highway"],
     ["绿洲","白骨废墟","玻璃沙丘","锈市","盐路","干涸湖","旧公路"],
     ["オアシス","骨の廃墟","硝子の砂丘","錆の市場","塩の道","涸れた湖","旧街道"],
     ["Оазис","Костяные руины","Стеклянные дюны","Ржавый рынок","Соляная дорога","Сухое озеро","Старое шоссе"]),
   L("waste","废土","荒地","пустошь")),
 W("paradise_isle","🌺",["gentle"],["rule_paradise"],["classic"],100,
   {"age":0,"health":100,"happiness":82,"intelligence":9,"social":12,"fitness":11,"money":60},"coastal",
   L("Paradise Isle","天堂岛","楽園の島","Райский остров"),
   L("A small island where everyone knows your name — for good and for ill.",
     "一座小岛，人人都叫得出你的名字——无论好坏。",
     "誰もがあなたの名を知る小さな島——良くも悪くも。",
     "Маленький остров, где все знают твоё имя — и в хорошем, и в плохом."),
   L(["Shell Bay","the Village","Coral Reef","the Long Jetty","the Lighthouse","the Mango Grove",
      "the Tide Pools","the Old Pier","the Chapel","the Fish Market","the Palm Shore","the Lookout"],
     ["贝壳湾","村庄","珊瑚礁","长栈桥","灯塔","芒果林","潮池","老码头","小教堂","鱼市","棕榈岸","了望台"],
     ["貝の入江","村","珊瑚礁","長い桟橋","灯台","マンゴーの林","潮だまり","古い桟橋","礼拝堂","魚市場","椰子の岸","見張り台"],
     ["Ракушечная бухта","Деревня","Коралловый риф","Длинный пирс","Маяк","Манговый сад","Приливные ванны","Старый причал","Часовня","Рыбный рынок","Пальмовый берег","Дозорная"]),
   L(["the fishing season","the spring tide","the storm that passed","the feast of the catch","the long summer","the ebb",
      "the moon tide","the season of weddings","the calm spell","the trader's visit"],
     ["渔季","春潮","过去的暴风","渔获之宴","长夏","退潮","月潮","婚礼之季","无风的时节","商人的来访"],
     ["漁の季節","春の大潮","去りし嵐","漁の祝宴","長い夏","引き潮","月の潮","婚礼の季節","凪の季節","商人の訪れ"],
     ["сезон рыбалки","весенний прилив","миновавшая буря","пир улова","долгое лето","отлив","лунный прилив","сезон свадеб","затишье","визит торговца"]),
   [["Nan","阿婆","おばあ","Бабушка"],["Kai","凯","カイ","Кай"],["Old Toma","老托马","老トマ","Старик Тома"],["Sister Mara","玛拉修女","マラ修道女","Сестра Мара"],
      ["Bram","布拉姆","ブラム","Брам"],["Little Coral","小珊瑚","小コーラル","Коралл"],["the Widow","寡妇","寡婦","Вдова"],
      ["the Boatwright","造船匠","造船工","Корабельщик"],["Old Salt","老盐","老いた塩","Старый Соль"],["the Singer","歌者","歌い手","Певица"]],
   L(["Landfall","Tide Prosperity","The Long Sun","The Calm","The Harvest Tides","Golden Shore"],
     ["登陆","潮汐繁荣","长日","平静","丰收之潮","金色海岸"],
     ["上陸","潮の繁栄","長い日","凪","実りの潮","黄金の岸"],
     ["Высадка","Приливное изобилие","Долгое солнце","Затишье","Урожайные приливы","Золотой берег"]),
   L(["The Fishers","The Keepers","The Boatwrights","The Elders","The Tide-Singers"],
     ["渔民","守望者","造船匠","长者","潮歌者"],
     ["漁師","守り人","造船工","長老","潮の歌い手"],
     ["Рыбаки","Хранители","Корабельщики","Старейшины","Певцы прилива"]),
   L(["Shell Bay","The Village","Coral Reef","Long Jetty","Fish Market","Lookout","Lighthouse"],
     ["贝壳湾","村庄","珊瑚礁","长栈桥","鱼市","了望台","灯塔"],
     ["貝の入江","村","珊瑚礁","長い桟橋","魚市場","見張り台","灯台"],
     ["Ракушечная бухта","Деревня","Коралловый риф","Длинный пирс","Рыбный рынок","Дозорная","Маяк"]),
   L("tide","潮汐","潮","прилив")),
 W("neon_city","🌃",["intrigue","industrial"],["rule_neon"],["high_kingdom"],90,
   {"age":0,"health":92,"happiness":52,"intelligence":13,"social":11,"fitness":8,"money":80},"temperate",
   L("Neon City","霓虹之城","ネオン・シティ","Неон-Сити"),
   L("A city that never sleeps and never forgives. Climb the towers, or be crushed under them.",
     "一座从不睡眠、从不宽恕的城市。要么攀上高塔，要么被碾在塔下。",
     "眠らず、許さない街。塔を登るか、塔に潰されるかだ。",
     "Город, который не спит и не прощает. Взбирайся на башни — или будь раздавлен."),
   L(["the Corporate Spire","Residential Blocks","the Underslum","the Data Gardens","the Chrome Market","Line Zero",
      "the Roof Farms","the Old Server Farm","the Ad Wall","the Clinic Vault","the Transit Spine","the Black Bazaar"],
     ["企业尖塔","住宅区","下层区","数据花园","镀铬市场","零号线","屋顶农场","旧服务器农场","广告墙","诊所金库","交通脊","黑市集"],
     ["企業塔","居住区","地下街","データ庭園","クローム市場","ゼロ線","屋上農場","旧サーバー農場","広告壁","診療金庫","交通幹","闇市"],
     ["Корпоративная игла","Жилые блоки","Поддон","Сады данных","Хромовый рынок","Нулевая линия","Крышные фермы","Старая ферма серверов","Рекламная стена","Хранилище клиники","Транспортный хребет","Чёрный базар"]),
   L(["the merger wars","the bandwidth famine","the night of the lights","the great glitch","the raid on the Spire","the open-source rebellion",
      "the ad surge","the blackout","the data boom","the quiet defection"],
     ["并购战","带宽饥荒","灯火之夜","大故障","突袭尖塔","开源起义","广告潮","停电","数据繁荣","静默叛逃"],
     ["合併戦争","帯域の飢饉","灯の夜","大故障","塔への襲撃","オープンソース反乱","広告の奔流","停電","データ繁栄","静かな離反"],
     ["войны слияний","голод по трафику","ночь огней","великий сбой","налёт на Иглу","восстание открытого кода","наплыв рекламы","блэкаут","бум данных","тихий перебежчик"]),
   [["Mama Chen","陈妈妈","チェン母","Мама Чэнь"],["Zero","零","ゼロ","Зеро"],["The Exec","高层","重役","Босс"],["Ghost","幽灵","ゴースト","Призрак"],
      ["Wrench","扳手","レンチ","Гаечный"],["Sable","赛博尔","セーブル","Соболь"],["Pixel","像素","ピクセル","Пиксель"],
      ["the Courier","信使","配達人","Курьер"],["Nyx","妮克斯","ニュクス","Никс"],["the Broker","掮客","仲介人","Посредник"]],
   L(["Analog Age","Uprising","Overclock","The Long Night","Ghost Era","Cold Boot"],
     ["模拟时代","起义","超频","长夜","幽灵纪元","冷启动"],
     ["アナログの時代","蜂起","オーバークロック","長き夜","幽霊の時代","冷起動"],
     ["Эпоха аналога","Восстание","Разгон","Долгая ночь","Эпоха призраков","Холодная загрузка"]),
   L(["The Corps","The Wired","The Freelancers","The Ghosts","The Couriers"],
     ["财团","连线者","自由职业者","幽灵","信使"],
     ["企業","接続者","フリーランサー","幽霊","配達人"],
     ["Корпорации","Сетевые","Фрилансеры","Призраки","Курьеры"]),
   L(["Corporate Spire","Residential Blocks","The Underslum","Chrome Market","Transit Spine","Black Bazaar","Roof Farms"],
     ["企业尖塔","住宅区","下层区","镀铬市场","交通脊","黑市集","屋顶农场"],
     ["企業塔","居住区","地下街","クローム市場","交通幹","闇市","屋上農場"],
     ["Корпоративная игла","Жилые блоки","Поддон","Хромовый рынок","Транспортный хребет","Чёрный базар","Крышные фермы"]),
   L("neon","霓虹","ネオン","неон")),
 W("high_kingdom","🏰",["order"],["rule_feudal"],["classic"],100,
   {"age":0,"health":98,"happiness":62,"intelligence":10,"social":11,"fitness":10,"money":40},"temperate",
   L("High Kingdom","高王国","ハイ・キングダム","Высокое королевство"),
   L("Rank is destiny. Rise through the court, or serve quietly and well.",
     "等级即命运。要么跻身宫廷，要么安静地尽忠。",
     "階級こそ運命。宮廷でのし上がるか、静かに尽くすか。",
     "Ранг — это судьба. Возвысься при дворе или служи тихо и верно."),
   L(["the Keep","Market Town","Grey Abbey","the Royal Court","the Tourney Grounds","the Old Bridge",
      "the Granary","the Smiths' Row","the King's Road","the Falcon Tower","the Cathedral","the Harbour Gate"],
     ["城堡","集镇","灰修道院","王庭","比武场","老桥","谷仓","铁匠巷","王道","猎鹰塔","大教堂","港门"],
     ["城","市場町","灰色修道院","王の宮廷","馬上試合場","古い橋","穀倉","鍛冶の並び","王の道","鷹の塔","大聖堂","港の門"],
     ["Замок","Рыночный город","Серое аббатство","Королевский двор","Поле турниров","Старый мост","Амбар","Кузнечный ряд","Королевский тракт","Башня сокола","Собор","Портные ворота"]),
   L(["the harvest fair","the royal succession","the border dispute","the plague of rats","the great hunt","the tax levy",
      "the tourney of the season","the coronation","the winter court","the rebellion in the north"],
     ["丰收集市","王室继承","边境争端","鼠疫","大狩猎","征税","季节比武","加冕","冬季宫廷","北方叛乱"],
     ["収穫祭","王位継承","国境紛争","鼠の疫","大狩猟","税の徴収","季節の馬上試合","戴冠","冬の宮廷","北の反乱"],
     ["ярмарка урожая","королевское наследие","пограничный спор","нашествие крыс","великая охота","сбор податей","турнир сезона","коронация","зимний двор","мятеж на севере"]),
   [["Mother","母亲","母","Мать"],["Squire Aldo","阿尔多","アルド","Альдо"],["Tutor Bede","比德","ビード","Бид"],["Bishop Owen","欧文主教","オーウェン司教","Епископ Оуэн"],
      ["Lady Sera","瑟拉夫人","セラ夫人","Леди Сера"],["the Steward","总管","執事","Управляющий"],["the Fool","弄臣","道化","Шут"],
      ["the Herald","传令","使者","Герольд"],["Old Marshal","老元帅","老元帥","Старый маршал"],["the Abbess","女院长","女子修道院長","Аббатиса"]],
   L(["Founding","High Court","Reform","The Long Peace","Twilight","The New Crown"],
     ["奠基","盛世宫廷","改革","长和平","黄昏","新王冠"],
     ["創建","盛期の宮廷","改革","長き平和","黄昏","新たな王冠"],
     ["Основание","Высокий двор","Реформа","Долгий мир","Сумерки","Новая корона"]),
   L(["The Crown","The Commons","The Clergy","The Knights","The Guilds"],
     ["王冠","平民","教士","骑士","行会"],
     ["王冠","平民","聖職者","騎士","ギルド"],
     ["Корона","Общины","Духовенство","Рыцари","Гильдии"]),
   L(["The Keep","Market Town","Grey Abbey","Tourney Grounds","King's Road","Falcon Tower","Cathedral"],
     ["城堡","集镇","灰修道院","比武场","王道","猎鹰塔","大教堂"],
     ["城","市場町","灰色修道院","馬上試合場","王の道","鷹の塔","大聖堂"],
     ["Замок","Рыночный город","Серое аббатство","Поле турниров","Королевский тракт","Башня сокола","Собор"]),
   L("crown","王冠","王冠","корона")),
 W("wilds","🌲",["wild","harsh"],["rule_wilderness"],["golden_age","high_kingdom"],85,
   {"age":0,"health":96,"happiness":55,"fitness":14,"intelligence":9,"social":7,"money":10},"highland",
   L("The Wilds","荒野","荒野","Дикие земли"),
   L("Beyond the last road: forests, storms and things with no names.",
     "在最后一条路之外：森林、风暴，以及叫不出名字的东西。",
     "最後の道の先へ：森、嵐、名もなきものたち。",
     "За последней дорогой: леса, бури и безымянные твари."),
   L(["Base Camp","the Black Woods","the Cold River","the Wolf Ridge","the Old Stone Circle","the Trapper's Cabin",
      "the Frozen Falls","the Deep Fen","the Pine Sea","the Cairn","the Elk Meadow","the Last Road"],
     ["营地","黑森林","冷河","狼脊","古老石圈","猎人小屋","冻瀑","深沼","松海","石冢","鹿草甸","最后一条路"],
     ["野営地","黒い森","冷たい川","狼の尾根","古い環状列石","罠師の小屋","凍れる滝","深き沼","松の海","ケルン","鹿の草原","最後の道"],
     ["Лагерь","Чёрный лес","Холодная река","Волчий хребет","Старый каменный круг","Хижина ловчего","Мёрзлый водопад","Глубокая топь","Сосновое море","Каирн","Олений луг","Последняя дорога"]),
   L(["the first snow","the wolf moon","the thaw","the great storm","the rutting season","the fire year",
      "the long rain","the comet night","the lean winter","the wild pox"],
     ["初雪","狼月","解冻","大风暴","交配季","大火之年","长雨","彗星夜","瘦冬","野痘"],
     ["初雪","狼の月","雪解け","大嵐","牡の季節","火の年","長雨","彗星の夜","痩せた冬","野生の痘瘡"],
     ["первый снег","волчья луна","оттепель","великая буря","гон","год огня","долгий дождь","ночь кометы","тощая зима","дикая оспа"]),
   [["Mama Fern","蕨妈妈","シダ母","Мама Ферн"],["Bear","大熊","ベア","Медведь"],["Old Crow","老鸦","老カラス","Старый Ворон"],["Something","某个东西","何か","Нечто"],
      ["Holly","冬青","ホリー","Падуб"],["Frost","霜","フロスト","Мороз"],["the Boy","男孩","少年","Мальчик"],
      ["Moss","苔","苔","Мох"],["the Hermit","隐者","隠者","Отшельник"],["Quick Fox","快狐","俊足の狐","Быстрая лиса"]],
   L(["Frontier","The Deep Wood","Old Growth","The Long Winter","Wildwood","First Thaw"],
     ["拓荒","深林","古木","长冬","蛮林","初融"],
     ["辺境","深き森","老木","長き冬","蛮森","初の雪解け"],
     ["Фронтир","Дремучий лес","Старый лес","Долгая зима","Диколесье","Первая оттепель"]),
   L(["The Trappers","The Kin","The Rangers","The Free Folk","The Wolf-Kin"],
     ["捕兽人","亲族","巡林人","自由民","狼族"],
     ["罠師","一族","野伏","自由の民","狼の民"],
     ["Ловчие","Родня","Егеря","Вольные","Волчья родня"]),
   L(["Base Camp","Black Woods","Cold River","Wolf Ridge","Elk Meadow","Last Road","Frozen Falls"],
     ["营地","黑森林","冷河","狼脊","鹿草甸","最后一条路","冻瀑"],
     ["野営地","黒い森","冷たい川","狼の尾根","鹿の草原","最後の道","凍れる滝"],
     ["Лагерь","Чёрный лес","Холодная река","Волчий хребет","Олений луг","Последняя дорога","Мёрзлый водопад"]),
   L("thicket","密林","茂み","чаща")),
]

# ---------- build ----------
def build(w):
    wid = w["id"]; base = os.path.join("resource","worlds",wid)
    for d in ("events","npcs","chronicle","pressures","rules","language"): os.makedirs(os.path.join(base,d), exist_ok=True)
    i18n = {l: {} for l in LANGS}
    def put(key, d4):
        for l in LANGS: i18n[l][key] = d4[l]
    put(f"world.{wid}", w["name"]); put(f"world.{wid}.desc", w["desc"])

    manifest = {"id":wid,"nameKey":f"world.{wid}","descriptionKey":f"world.{wid}.desc","icon":w["icon"],
        "tags":w["tags"],"difficultyIdentification":("easy" if "gentle" in w["tags"] else ("expert" if "harsh" in w["tags"] else "normal")),
        "contentVersion":3,"startPlayer":w["start"],"unlockRequires":w["unlock"],"selfContained":True,
        "worldRules":w["rules"],"algorithm":"default",
        "completionConditions":[{"type":"generalPurpose","params":{"prop":"age","num":w["complete"],"cat":"greaterThan"}}]}
    json.dump(manifest, open(f"{base}/world.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)

    # NPCs
    npcs=[]; roles=["family","friend","mentor","rival","work","family","rival","friend","mentor","work"]
    for i,(n4) in enumerate(w["npcs"]):
        nid=f"npc_{wid}_{i+1}"
        npcs.append({"id":nid,"roleKey":role(roles[i%len(roles)]),"initial":max(5,50-i*4),"startAge":30,
                     "labelKey":f"{wid}.npc.{i+1}","descKey":f"{wid}.npc.{i+1}.desc","dialogueKeys":[f"{wid}.npc.{i+1}.l1",f"{wid}.npc.{i+1}.l2"]})
        # n4 is [en,zh,ja,ru]
        put(f"{wid}.npc.{i+1}", L(n4[0],n4[1],n4[2],n4[3]))
        put(f"{wid}.npc.{i+1}.desc", L(f"A soul of {w['name']['en_US']}.",f"{w['name']['zh_CN']}中的一个人。",f"{w['name']['ja_JP']}の一人。",f"Душа из {w['name']['ru_RU']}."))
        put(f"{wid}.npc.{i+1}.l1", L("We'll talk later.","回头再说。","また後で話そう。","Поговорим позже."))
        put(f"{wid}.npc.{i+1}.l2", L("Keep your head down.","把头低下去。","頭を低くしておけ。","Держи голову ниже."))
    json.dump(npcs, open(f"{base}/npcs/cast.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)

    # Chronicle
    eras=[]
    yrs=[0,16,32,50,68,86]
    icons=["🌅","⚒","⚙","⚡","✦","🌌"]; colors=["yellow","gray","white","cyan","magentaBright","blue"]
    for i in range(min(len(w["eras"]["en_US"]),6)):
        eras.append({"id":f"era_{wid}_{i+1}","labelKey":f"{wid}.era.{i+1}","descKey":f"{wid}.era.{i+1}.desc","fromYear":yrs[i],"icon":icons[i],"color":colors[i]})
        put(f"{wid}.era.{i+1}", L(w["eras"]["en_US"][i],w["eras"]["zh_CN"][i],w["eras"]["ja_JP"][i],w["eras"]["ru_RU"][i]))
        put(f"{wid}.era.{i+1}.desc", L(f"The age of {w['eras']['en_US'][i]}.",f"{w['eras']['zh_CN'][i]}的时代。",f"{w['eras']['ja_JP'][i]}の時代。",f"Эпоха: {w['eras']['ru_RU'][i]}."))
    json.dump(eras, open(f"{base}/chronicle/eras.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    facs=[]
    ficons=["👑","⚔","🕯","🔧","🕸"]
    for i in range(len(w["facs"]["en_US"])):
        facs.append({"id":f"fac_{wid}_{i+1}","labelKey":f"{wid}.fac.{i+1}","descKey":f"{wid}.fac.{i+1}.desc","icon":ficons[i],"rivals":[f"fac_{wid}_{((i+1)%len(w['facs']['en_US']))+1}"]})
        put(f"{wid}.fac.{i+1}", L(w["facs"]["en_US"][i],w["facs"]["zh_CN"][i],w["facs"]["ja_JP"][i],w["facs"]["ru_RU"][i]))
        put(f"{wid}.fac.{i+1}.desc", L(f"The power of {w['facs']['en_US'][i]}.",f"{w['facs']['zh_CN'][i]}的势力。",f"{w['facs']['ja_JP'][i]}の勢力。",f"Сила: {w['facs']['ru_RU'][i]}."))
    json.dump(facs, open(f"{base}/chronicle/factions.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    regs=[]
    for i in range(len(w["regs"]["en_US"])):
        regs.append({"id":f"reg_{wid}_{i+1}","labelKey":f"{wid}.reg.{i+1}","descKey":f"{wid}.reg.{i+1}.desc","icon":"📍","climate":w["climate"],
                     "neighbors":[f"reg_{wid}_{((i)%len(w['regs']['en_US']))+1}"]})
        put(f"{wid}.reg.{i+1}", L(w["regs"]["en_US"][i],w["regs"]["zh_CN"][i],w["regs"]["ja_JP"][i],w["regs"]["ru_RU"][i]))
        put(f"{wid}.reg.{i+1}.desc", L(f"{w['regs']['en_US'][i]}, a place in {w['name']['en_US']}.",f"{w['regs']['zh_CN'][i]}，{w['name']['zh_CN']}中的一地。",f"{w['regs']['ja_JP'][i]}、{w['name']['ja_JP']}の地。",f"{w['regs']['ru_RU'][i]} — место в {w['name']['ru_RU']}."))
    json.dump(regs, open(f"{base}/chronicle/regions.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    # lore (16)
    unlocks=[{"kind":"year","year":1},{"kind":"year","year":16},{"kind":"era","era":f"era_{wid}_3"},{"kind":"era","era":f"era_{wid}_5"},
             {"kind":"karma","axis":"ambition","gte":30},{"kind":"karma","axis":"wisdom","gte":30},{"kind":"karma","axis":"benevolence","gte":30},{"kind":"karma","axis":"rebellion","gte":30},
             {"kind":"flag","flag":"traveled"},{"kind":"year","year":60},{"kind":"era","era":f"era_{wid}_6"},{"kind":"karma","axis":"wisdom","gte":60},
             {"kind":"year","year":30},{"kind":"year","year":45},{"kind":"karma","axis":"benevolence","gte":60},{"kind":"karma","axis":"rebellion","gte":60}]
    lore=[]
    for i in range(16):
        lore.append({"id":f"lore_{wid}_{i+1}","titleKey":f"{wid}.lore.{i+1}","bodyKey":f"{wid}.lore.{i+1}.body","category":["era","era","era","era","karma","karma","karma","karma","deed","era","secret","secret","era","era","secret","secret"][i],"unlock":unlocks[i]})
        put(f"{wid}.lore.{i+1}", L(f"Chronicle {i+1} of {w['name']['en_US']}",f"{w['name']['zh_CN']}编年·其{i+1}",f"{w['name']['ja_JP']}年代記・{i+1}",f"Хроника {i+1}: {w['name']['ru_RU']}"))
        put(f"{wid}.lore.{i+1}.body", L(f"A fragment of {w['theme']['en_US']} lore kept by the people of {w['name']['en_US']}.",
             f"一段关于{w['theme']['zh_CN']}的传说，由{w['name']['zh_CN']}的人们保存。",
             f"{w['theme']['ja_JP']}にまつわる伝承の断片、{w['name']['ja_JP']}の人々が伝える。",
             f"Обрывок преданий о {w['theme']['ru_RU']}, хранимый людьми {w['name']['ru_RU']}."))
    json.dump(lore, open(f"{base}/chronicle/lore.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    # fates (6)
    fates=[]
    fu=[{"kind":"karma","axis":"wisdom","gte":40},{"kind":"karma","axis":"ambition","gte":40},{"kind":"karma","axis":"benevolence","gte":40},{"kind":"karma","axis":"rebellion","gte":40},{"kind":"year","year":50},{"kind":"era","era":f"era_{wid}_5"}]
    for i in range(6):
        fates.append({"id":f"fate_{wid}_{i+1}","labelKey":f"{wid}.fate.{i+1}","descKey":f"{wid}.fate.{i+1}.desc","icon":"✦","unlock":fu[i],"factor":2})
        put(f"{wid}.fate.{i+1}", L(f"Destiny {i+1} of {w['name']['en_US']}",f"{w['name']['zh_CN']}的命运·其{i+1}",f"{w['name']['ja_JP']}の運命・{i+1}",f"Судьба {i+1}: {w['name']['ru_RU']}"))
        put(f"{wid}.fate.{i+1}.desc", L("A calling native to this world.","此世界特有的天职。","この世界固有の使命。","Призвание, рождённое этим миром."))
    json.dump(fates, open(f"{base}/chronicle/fates.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    # world events (6) referencing own axes
    axids=[f"pr_{wid}_{i+1}" for i in range(8)]
    we=[]
    for i in range(6):
        we.append({"id":f"we_{wid}_{i+1}","year":[8,26,44,62,80,96][i],"labelKey":f"{wid}.we.{i+1}","bodyKey":f"{wid}.we.{i+1}.body",
                   "pressures":{axids[i%8]:[-8,-12,10,15,-6,12][i],axids[(i+1)%8]:[8,10,-6,-10,12,-8][i]}})
        put(f"{wid}.we.{i+1}", L(f"Turning point {i+1}",f"转折·其{i+1}",f"転機・{i+1}",f"Поворот {i+1}"))
        put(f"{wid}.we.{i+1}.body", L("The world shifts beneath everyone's feet.","世界在所有人脚下转向。","世界が皆の足元で揺らぐ。","Мир смещается под ногами всех."))
    json.dump(we, open(f"{base}/chronicle/worldEvents.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)

    # pressures (8 axes + rules)
    acls=["nature","society","economy","culture","supernatural","meta","society","economy"]
    ax=[]
    for i in range(8):
        ax.append({"id":f"pr_{wid}_{i+1}","labelKey":f"{wid}.pr.{i+1}","class":acls[i],"min":0,"max":100,"initial":[70,55,60,55,35,50,58,52][i],"baseline":50,"drift":0.05})
        put(f"{wid}.pr.{i+1}", L(f"{w['name']['en_US']} pressure {i+1}",f"{w['name']['zh_CN']}气压·其{i+1}",f"{w['name']['ja_JP']}の圧・{i+1}",f"Давление {i+1}: {w['name']['ru_RU']}"))
    json.dump(ax, open(f"{base}/pressures/axes.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    rules=[{"source":axids[i],"target":axids[(i+1)%8],"threshold":50,"factor":[0.10,0.08,0.07,0.06,-0.05,0.06,0.05,0.05][i]} for i in range(8)]
    json.dump(rules, open(f"{base}/pressures/rules.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump([], open(f"{base}/rules/rules.json","w",encoding="utf-8"))

    # events: archetypes x topics
    evs=[]
    P=w["places"]; F=w["flavors"]
    for ai,a in enumerate(ARCH):
        for k in range(4):
            idx=ai*4+k
            place={l:P[l][idx%len(P[l])] for l in LANGS}
            flavor={l:F[l][(idx*3+2)%len(F[l])] for l in LANGS}
            eid=f"{wid}_ev_{a['id']}_{k+1}"; nk=f"{wid}.ev.{a['id']}.{k+1}"
            # title
            put(nk, L(f"{a['title']['en_US']} — {place['en_US']}",
                      f"{a['title']['zh_CN']}·{place['zh_CN']}",
                      f"{a['title']['ja_JP']}・{place['ja_JP']}",
                      f"{a['title']['ru_RU']} — {place['ru_RU']}"))
            # text
            def mk(l): return a["frame"][l].replace("{place}", place[l]).replace("{flavor}", flavor[l])
            put(f"{nk}.text", L(mk("en_US"),mk("zh_CN"),mk("ja_JP"),mk("ru_RU")))
            choices=[]
            for (cid,label,sign) in a["choices"]:
                choices.append({"id":cid,"labelKey":f"{nk}.{cid}","effects":eff(sign,a["tag"]),"noteKey":f"{nk}.{cid}.note"})
                put(f"{nk}.{cid}", label)
                put(f"{nk}.{cid}.note", L(f"You chose to {label['en_US'][0].lower()+label['en_US'][1:]}.",
                                          f"你选择了「{label['zh_CN']}」。",
                                          f"「{label['ja_JP']}」を選んだ。",
                                          f"Ты выбрал: {label['ru_RU']}."))
            e={"type":"ChoiceEvent","id":eid,"nameKey":nk,"textKey":f"{nk}.text","rangeKey":[BANDS[a["band"]]],
               "weight":a["w"],"tags":[a["tag"]],"choices":choices}
            if a["cat"]: e["category"]=a["cat"]
            if a["once"]: e["once"]=True
            evs.append(e)
    # ambient effect events
    amb=[("quiet",L("A Quiet Time","平静之时","静かな時","Тихое время"),{"happiness":2}),
         ("omen",L("Good Omens","吉兆","吉兆","Добрые знамения"),{"happiness":3,"reputation":2}),
         ("hard",L("Hard Times","艰难时世","困難な時代","Трудные времена"),{"happiness":-2,"health":-2}),
         ("dread",L("Creeping Dread","蔓延的恐惧","忍び寄る不安","Ползучий страх"),{"depressionValue":4}),
         ("bounty",L("A Small Bounty","小小的恩惠","小さな恵み","Малая милость"),{"money":20}),
         ("weariness",L("Weariness","疲惫","倦怠","Усталость"),{"weakValue":4})]
    for (aid,nm,ef) in amb:
        eid=f"{wid}_ev_{aid}"; k=f"{wid}.ev.{aid}"
        tag="challenge" if any(v<0 or aid in("dread","weariness") for v in ef.values()) else "boon"
        evs.append({"type":"EffectEvent","id":eid,"nameKey":k,"textKey":f"{k}.text","rangeKey":["3-100"],
                    "weight":0.5,"tags":[tag,"comfort" if tag=="boon" else "stress"],"params":{"effects":ef}})
        put(k,nm)
        put(f"{k}.text", L("The world turns, and you with it.","世界转动，你也随之。","世界は巡り、あなたも巡る。","Мир вращается — и ты вместе с ним."))
    # chunk events into files of ~40
    for ci in range(0, len(evs), 40):
        json.dump(evs[ci:ci+40], open(f"{base}/events/events_{ci//40+1}.json","w",encoding="utf-8"), ensure_ascii=False, indent=2)
    # remove stale event files
    for f in glob.glob(f"{base}/events/*.json"):
        n=os.path.basename(f)
        if not n.startswith("events_"):
            os.remove(f)

    # write language files
    for l in LANGS:
        json.dump(i18n[l], open(f"{base}/language/{l}.json","w",encoding="utf-8"), ensure_ascii=False, indent=4)
    return len(evs)

# purge stale world keys from global language packs
WORLD_IDS=[w["id"] for w in WORLDS]
def is_world_key(k):
    return any(k==f"world.{w}" or k==f"world.{w}.desc" or k.startswith(w+".") for w in WORLD_IDS)
for l in LANGS:
    p=f"resource/language/{l}.json"; d=json.load(open(p,encoding="utf-8"))
    for k in [k for k in list(d.keys()) if is_world_key(k)]: del d[k]
    json.dump(d, open(p,"w",encoding="utf-8"), ensure_ascii=False, indent=4)

for w in WORLDS:
    n=build(w); print(f"built {w['id']}: {n} events")
print("done")
