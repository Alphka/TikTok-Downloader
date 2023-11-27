import { createWriteStream, existsSync, readFileSync } from "fs"
import { HttpCookieAgent, HttpsCookieAgent } from "http-cookie-agent/http"
import { mkdir, utimes } from "fs/promises"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { AxiosError } from "axios"
import { CookieJar } from "tough-cookie"
import axios from "axios"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const jar = new CookieJar()

const client = axios.create({
	httpAgent: new HttpCookieAgent({ cookies: { jar } }),
	httpsAgent: new HttpsCookieAgent({ cookies: { jar } })
})

const rootFolder = join(__dirname, "..")
const listPath = join(rootFolder, "list.txt")
const outputFolder = join(rootFolder, "output")

const informationRegex = /\{"__DEFAULT_SCOPE__":\{.*?"playAddr":.*?\}(?=<\/script>)/

/**
 * @param {string} username
 * @param {string} videoId
 */
async function DownloadVideo(username, videoId){
	const url = `https://www.tiktok.com/@${username}/video/${videoId}`

	const response = await client.get(url, {
		headers: {
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*\/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
			"Accept-Language": "en-US,en;q=0.9",
			Origin: "https://www.tiktok.com/",
			Priority: "u=0, i",
			"Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
			"Sec-Ch-Ua-Mobile": "?0",
			"Sec-Ch-Ua-Platform": '"Windows"',
			"Sec-Fetch-Dest": "document",
			"Sec-Fetch-Mode": "navigate",
			"Sec-Fetch-Site": "none",
			"Sec-Fetch-User": "?1",
			"Upgrade-Insecure-Requests": "1",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
		},
		validateStatus: () => true,
		responseType: "text"
	})

	try{
		const informationMatch = response.data.match(informationRegex)

		if(!informationMatch) throw `Video information regex did not match (${videoId})`

		const { __DEFAULT_SCOPE__: informationObject } = JSON.parse(informationMatch[0])
		const { video: { playAddr: downloadUrl }, createTime } = informationObject["webapp.video-detail"].itemInfo.itemStruct

		const outputFile = join(outputFolder, `${videoId}.mp4`)

		console.log(`Downloading video (${videoId})`)

		try{
			/** @type {import("axios").AxiosResponse<import("stream").Writable>} */
			const { data: downloadStream } = await client.get(downloadUrl, {
				headers: {
					Accept: "*\/*",
					"Accept-Encoding": "identity",
					"Accept-Language": "en-US,en;q=0.9",
					"Cache-Control": "no-cache",
					Pragma: "no-cache",
					Range: "bytes=0-",
					Origin: "https://www.tiktok.com",
					Referer: "https://www.tiktok.com/",
					Priority: "u=1, i",
					"Sec-Ch-Ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
					"Sec-Ch-Ua-Mobile": "?0",
					"Sec-Ch-Ua-Platform": '"Windows"',
					"Sec-Fetch-Dest": "video",
					"Sec-Fetch-Mode": "no-cors",
					"Sec-Fetch-Site": "same-site",
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
				},
				responseType: "stream"
			})

			if(!existsSync(outputFolder)) await mkdir(outputFolder, { recursive: true })

			downloadStream.pipe(createWriteStream(outputFile), { end: true }).on("close", () => {
				const ctime = createTime ? Number(createTime) : 0
				if(ctime > 0 && !Number.isNaN(ctime)) return utimes(outputFile, new Date, new Date(ctime * 1e3))
			})
		}catch(error){
			if(error instanceof AxiosError) console.error(`Error downloading video (${videoId}), status: ${error.response.status}`)
			else console.error(error)
		}
	}catch(error){
		console.error(error)
	}
}

async function DownloadList(){
	const list = readFileSync(listPath, "utf8")
		.trim()
		.split(/\n+/)
		.map(url => url.trim())
		.filter(Boolean)

	const { length } = list

	if(!length) throw new Error("There are no videos to download")

	console.log(`Downloading ${length} ${length === 1 ? "video" : "videos"}...`)

	for(const videoUrl of list){
		const [username,, videoId] = new URL(videoUrl).pathname.slice(1).split("/")

		try{
			await DownloadVideo(username, videoId)
		}catch(error){
			error.message += " Video ID: " + videoId
			console.error(error)
		}
	}

	console.log("\nDownloads finished")
}

DownloadList()
