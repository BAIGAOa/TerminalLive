# -*- coding: utf-8 -*-
"""Generate built-in plugins: one per world under resource/plugins/<id>_plugin/,
each adding 50+ NPC behaviours and 30 hidden-score axes (with coupling rules).
All text is written into the world's own language pack (so it resolves when that
world is active)."""
import json, os

LANGS = ["en_US", "zh_CN", "ja_JP", "ru_RU"]
def L(en, zh, ja, ru): return {"en_US": en, "zh_CN": zh, "ja_JP": ja, "ru_RU": ru}

WORLDS = {
 "hellscape":    L("Hellscape","炼狱","地獄","Преисподняя"),
 "paranoia":     L("The Watchful","瞩目之域","監視の国","Надзор"),
 "golden_age":   L("Golden Age","黄金时代","黄金時代","Золотой век"),
 "plague_years": L("Plague Years","瘟疫年代","疫病の時代","Годы чумы"),
 "wasteland":    L("Wasteland","废土","荒れ地","Пустошь"),
 "paradise_isle":L("Paradise Isle","天堂岛","楽園の島","Райский остров"),
 "neon_city":    L("Neon City","霓虹之城","ネオン・シティ","Неон-Сити"),
 "high_kingdom": L("High Kingdom","高王国","ハイ・キングダム","Высокое королевство"),
 "wilds":        L("The Wilds","荒野","荒野","Дикие земли"),
}

# ---- NPC behaviour archetypes ----
# passive: (id, effects, affinity) ; name text per lang
PASSIVE = [
 ("care",  {"health":4,"happiness":3}, 3,  L("Tends your wounds","替你处理伤口","傷の手当て","Перевязывает раны")),
 ("meal",  {"happiness":5}, 2,            L("Shares a meal","分你一顿饭","食事を分ける","Делится едой")),
 ("coin",  {"money":25}, 1,               L("Slips you coin","悄悄塞钱给你","金を握らせる","Подкидывает монету")),
 ("talk",  {"social":3,"happiness":2}, 2, L("Long talk","长谈","長話","Долгий разговор")),
 ("teach", {"intelligence":3}, 2,         L("Teaches a trick","教你一手","コツを教える","Учит приёму")),
 ("train", {"fitness":3}, 1,              L("Spars with you","与你对练","手合わせ","Спаррингует с тобой")),
 ("warn",  {"reputation":3}, 2,           L("Warns you","警告你","警告する","Предупреждает")),
 ("gift",  {"happiness":4}, 4,            L("Brings a gift","带来礼物","贈り物を運ぶ","Приносит дар")),
 ("song",  {"depressionValue":-6,"happiness":2}, 2, L("Sings to lift you","唱歌让你振作","歌で励ます","Поёт, чтобы взбодрить")),
 ("rest",  {"weakValue":-6,"health":2}, 2, L("Makes you rest","让你歇息","休ませる","Заставляет отдохнуть")),
 ("debt",  {"money":-30,"happiness":1}, -1, L("Borrows, then repays","借钱又还钱","借りて返す","Одалживает и возвращает")),
 ("rumor", {"reputation":-3,"angerValue":3}, -2, L("Spreads a rumour","散布流言","噂を流す","Разносит слух")),
 ("taunt", {"happiness":-3}, -3,          L("Taunts you","奚落你","嘲笑う","Дразнит тебя")),
 ("scheme",{"money":-40,"angerValue":4}, -4, L("Pulls a quiet scheme","暗中使坏","陰で策を巡らす","Тихо строит козни")),
 ("upkeep",{"reputation":2,"money":10}, 1, L("Puts in a good word","替你说好话","口添えする","Замолвливает слово")),
]
# offer archetypes: (id, name, prompt)
OFFER = [
 ("visit", L("Invites you over","邀你上门","家に招く","Зовёт в гости"), L("They ask you to come by. Go?","他们邀你过去。去吗？","来てほしいという。行く？","Зовут зайти. Пойти?")),
 ("favor", L("Asks a favour","求你帮忙","頼みごと","Просит об услуге"), L("They ask a favour. Help?","他们求你帮忙。帮吗？","頼みを聞く？","Просят об услуге. Помочь?")),
 ("venture", L("Proposes a venture","提议合伙","共同を提案","Предлагает дело"), L("A scheme to share. Join?","一个合伙的方案。加入吗？","共同の話。乗る？","Схема для двоих. Войти?")),
 ("feast", L("Calls a gathering","召集聚会","集いを呼びかける","Созывает сборище"), L("A feast is called. Attend?","有人召集宴席。去吗？","宴が呼ばれる。行く？","Зовут на пир. Прийти?")),
 ("secret", L("Shares a secret","吐露秘密","秘密を打ち明ける","Делится тайной"), L("They offer a secret. Listen?","他们要吐露秘密。听吗？","秘密を打ち明ける。聞く？","Предлагают тайну. Слушать?")),
 ("duel", L("Proposes a contest","提出较量","勝負を挑む","Предлагает поединок"), L("A contest of skill. Accept?","一场技艺较量。接受吗？","腕比べ。受ける？","Состязание. Принять?")),
 ("trade", L("Offers a trade","提出交易","取引を持ちかける","Предлагает обмен"), L("A trade is on the table. Deal?","桌上有笔交易。成交吗？","取引の話。受ける？","Предлагают обмен. Согласиться?")),
 ("journey", L("Suggests a journey","提议同行","旅を誘う","Зовёт в путь"), L("A road together. Go?","一起上路。去吗？","共に行く？","Дорога вдвоём. Идти?")),
]

def variant_gate(v):
    # v0: any age; v1: 16+; v2: under 30
    return {} if v == 0 else ({"minAge": 16} if v == 1 else {"maxAge": 30})

def build_plugin(wid, wname):
    root = os.path.join("resource", "plugins", f"{wid}_plugin")
    os.makedirs(root, exist_ok=True)
    lang = {l: {} for l in LANGS}
    def put(k, d4):
        for l in LANGS: lang[l][k] = d4[l]

    behaviors = []
    # passives: 15 archetypes x 3 variants = 45
    for (aid, effects, aff, name) in PASSIVE:
        for v in range(3):
            bid = f"{wid}_pb_{aid}_{v+1}"
            key = f"{wid}.beh.{aid}.{v+1}"
            eff = {k: (val * (1 + v * 0.5)) for k, val in effects.items()}
            eff = {k: (round(x) if isinstance(x, float) else x) for k, x in eff.items()}
            behaviors.append({"id": bid, "labelKey": key, "weight": 1, "kind": "passive",
                              "effects": eff, "affinity": aff, "resultKey": f"{key}.res", **variant_gate(v)})
            put(key, name)
            put(f"{key}.res", L(f"{name['en_US']} — {wname['en_US']}", f"{name['zh_CN']}——{wname['zh_CN']}", f"{name['ja_JP']}——{wname['ja_JP']}", f"{name['ru_RU']} — {wname['ru_RU']}"))
    # offers: 8 archetypes x 2 variants = 16
    for (aid, name, prompt) in OFFER:
        for v in range(2):
            bid = f"{wid}_po_{aid}_{v+1}"
            key = f"{wid}.off.{aid}.{v+1}"
            opts = [
                {"id": "yes", "labelKey": f"{key}.yes", "effects": {"happiness": 6, "reputation": 3}, "affinity": 6, "resultKey": f"{key}.yes.res"},
                {"id": "no",  "labelKey": f"{key}.no",  "effects": {"happiness": -2, "angerValue": 2}, "affinity": -4, "resultKey": f"{key}.no.res"},
            ]
            behaviors.append({"id": bid, "labelKey": key, "weight": 1, "kind": "offer",
                              "minAffinity": 20 + v * 20, "offerTextKey": f"{key}.text",
                              "options": opts, **variant_gate(v)})
            put(key, name)
            put(f"{key}.text", prompt)
            put(f"{key}.yes", L("Agree","答应","応じる","Согласиться"))
            put(f"{key}.no", L("Decline","婉拒","断る","Отказаться"))
            put(f"{key}.yes.res", L("It goes well.","结果不错。","うまくいった。","Всё хорошо."))
            put(f"{key}.no.res", L("They take it poorly.","对方不快。","相手は不満げだ。","Недовольны."))

    # 30 hidden-score axes
    PRESSURES = [
      ("order","meta"),("chaos","meta"),("faith","culture"),("doubt","culture"),("wealth","economy"),("want","economy"),
      ("health","nature"),("blight","nature"),("hope","culture"),("despair","meta"),("honor","society"),("shame","society"),
      ("law","society"),("crime","society"),("learning","culture"),("ignorance","culture"),("industry","economy"),("idle","economy"),
      ("strife","society"),("calm","meta"),("mystic","supernatural"),("mundane","meta"),("glory","culture"),("infamy","society"),
      ("charity","society"),("greed","economy"),("vigor","nature"),("frailty","nature"),("unity","society"),("strife2","society"),
    ]
    NAMES = [
      L("Order","秩序","秩序","Порядок"),L("Chaos","混乱","混沌","Хаос"),L("Faith","信仰","信仰","Вера"),L("Doubt","疑虑","疑念","Сомнение"),
      L("Wealth","财富","富","Богатство"),L("Want","匮乏","欠乏","Нужда"),L("Health","健康","健康","Здоровье"),L("Blight","枯萎","疫病","Порча"),
      L("Hope","希望","希望","Надежда"),L("Despair","绝望","絶望","Отчаяние"),L("Honour","荣誉","名誉","Честь"),L("Shame","耻辱","耻辱","Стыд"),
      L("Law","律法","法","Закон"),L("Crime","罪恶","犯罪","Преступность"),L("Learning","学问","学問","Знание"),L("Ignorance","蒙昧","無知","Невежество"),
      L("Industry","工业","産業","Промышленность"),L("Idle","懈怠","怠惰","Праздность"),L("Strife","争斗","争い","Раздор"),L("Calm","安宁","平穏","Покой"),
      L("Mystic","玄秘","神秘","Мистика"),L("Mundane","尘世","俗世","Обыденность"),L("Glory","荣光","栄光","Слава"),L("Infamy","恶名","悪名","Дурная слава"),
      L("Charity","仁善","慈悲","Милосердие"),L("Greed","贪婪","強欲","Жадность"),L("Vigor","活力","活力","Сила"),L("Frailty","虚弱","虚弱","Немощь"),
      L("Unity","团结","結束","Единство"),L("Discord","不和","不和","Разлад"),
    ]
    axcls = ["meta","meta","culture","culture","economy","economy","nature","nature","culture","meta","society","society",
             "society","society","culture","culture","economy","economy","society","meta","supernatural","meta","culture","society",
             "society","economy","nature","nature","society","society"]
    axes=[]; rules=[]
    for i,(aid,_cls) in enumerate(PRESSURES):
        pid=f"pr_{wid}_x{i+1}"
        axes.append({"id":pid,"labelKey":f"{wid}.px.{i+1}","class":axcls[i],"min":0,"max":100,"initial":[40,60,50,50][i%4],"baseline":50,"drift":0.05})
        put(f"{wid}.px.{i+1}", NAMES[i])
    for i in range(0, 30, 2):
        rules.append({"source":f"pr_{wid}_x{i+1}","target":f"pr_{wid}_x{(i+2)%30+1}","threshold":50,"factor":0.05})

    plugin = {
        "id": f"{wid}_plugin",
        "nameKey": f"{wid}.plugin",
        "descKey": f"{wid}.plugin.desc",
        "world": wid,
        "npcBehaviors": behaviors,
        "pressures": {"axes": axes, "rules": rules},
        "worldRules": [],
    }
    json.dump(plugin, open(os.path.join(root, "plugin.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    put(f"{wid}.plugin", L(f"{wname['en_US']} — behaviours", f"{wname['zh_CN']}·行为扩展", f"{wname['ja_JP']}・行動拡張", f"{wname['ru_RU']} — поведения"))
    put(f"{wid}.plugin.desc", L("Extra NPC behaviours and hidden scores for this world.",
        "为本世界追加的 NPC 行为与隐藏分。","この世界向けの追加 NPC 行動と隠しスコア。","Доп. поведения NPC и скрытые счёты для этого мира."))

    # merge into the world's language packs
    for l in LANGS:
        p = os.path.join("resource","worlds",wid,"language",f"{l}.json")
        d = json.load(open(p, encoding="utf-8")) if os.path.exists(p) else {}
        d.update(lang[l])
        json.dump(d, open(p,"w",encoding="utf-8"), ensure_ascii=False, indent=4)
    return len(behaviors)

for wid, wname in WORLDS.items():
    n = build_plugin(wid, wname)
    print(f"{wid}: {n} behaviours + 30 axes")
print("plugins done")
