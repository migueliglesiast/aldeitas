import axios from "axios";

const slugs = [
  "arbolita1",
  "arbolita2",
  "arbolita3",
  "arbolita4",
  "arbolita5",
  "arbolita6",
  "arbolita7",
];

async function main() {
  for (const slug of slugs) {
    try {
      const res = await axios.get(`https://www.airbnb.com/h/${slug}`, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        maxRedirects: 5,
      });
      const final = (res.request as any).res?.responseUrl as string;
      const id = final.match(/rooms\/(\d+)/)?.[1] || "n/a";
      const title = res.data.match(/<title>([^<]+)/)?.[1]?.slice(0, 90) || "";
      console.log(`${slug} -> ${id} | ${title}`);
    } catch (error: any) {
      console.log(`${slug} FAIL ${error.message}`);
    }
  }
}

main();
