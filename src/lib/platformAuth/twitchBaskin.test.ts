import { describe, expect, it } from "vitest";
import { takipYayinlari } from "./twitchWrite";

describe("baskın listesi (Y10)", () => {
  it("Get Followed Streams yanıtını izleyiciye göre sıralar, kimliksizi atar", () => {
    const l = takipYayinlari([
      { user_id: "1", user_login: "az", user_name: "Az", game_name: "Chess", viewer_count: 5, title: "a" },
      { user_id: "2", user_login: "cok", user_name: "Çok", viewer_count: 500 },
      { user_login: "kimliksiz", viewer_count: 9999 },
    ]);
    expect(l.map((y) => [y.login, y.izleyici, y.kategori])).toEqual([["cok", 500, ""], ["az", 5, "Chess"]]);
    expect(takipYayinlari(undefined)).toEqual([]);
  });
});
