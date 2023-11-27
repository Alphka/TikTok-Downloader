let run = true, delay = 300

;(async () => {
	const urls = new Set

	while(run){
		const links = document.querySelectorAll(`a[href^="${location.origin + location.pathname}/video/"]`)

		for(const link of Array.from(links)){
			urls.add(link.href)
		}

		await new Promise(resolve => setTimeout(resolve, delay))
		links[links.length - 1].scrollIntoView()
	}

	console.log(Array.from(urls).join("\n"))
})()
