const json = require('koa-json');
const Koa = require('koa');
const app = new Koa();
const Tile38 = require('tile38');
const fetch = require("node-fetch");

app.use(json())

app.use(async (ctx) => {
    if ("/haltestellen" == ctx.path && "GET" == ctx.method) {
        var client = new Tile38();
        var limit = parseInt(ctx.query.limit);
        if (isNaN(limit) || limit < 0) {
            limit = 10;
        }
        var distance = parseFloat(ctx.query.distance);
        if (isNaN(distance) || distance < 0) {
            distance = 1000;
        }
        let lat = parseFloat(ctx.query.lat);
        if (isNaN(lat)) {
            lat = 48.0;
        }
        let lng = parseFloat(ctx.query.lng);
        if (isNaN(lng)) {
            lat = 16.0;
        }
        var res = await client.nearbyQuery("haltestelle")
            .limit(limit)
            .point(ctx.query.lat, ctx.query.lng, distance)
            .execute();
        var divaFieldIdx = 0;
        var map = (res.objects || []).map(async element => {
            return {
                lat: element.object.coordinates[1],
                lng: element.object.coordinates[0],
                name: (await client.get("haltestelle", element.id + ":name")).object,
                id: element.id,
                diva: element.fields[divaFieldIdx]
            }
        });
        ctx.body = await Promise.all(map);
    }
    else if ("/update" == ctx.path && "POST" == ctx.method) {
        var res = await fetch("https://data.wien.gv.at/csv/wienerlinien-ogd-haltestellen.csv");
        var text = await res.text();

        var haltestellen = [];
        for (var line of text.split("\n")) {
            if (line.indexOf("HALTESTELLEN_ID") > 0) {
                continue;
            }
            var values = line.split(";");
            try {
                let h = {
                    id: values[0],
                    diva: values[2],
                    name: values[3].replace(/\"/g, ""),
                    lat: parseFloat(values[6]),
                    lng: parseFloat(values[7])
                };
                if (!isNaN(h.lat) && !isNaN(h.lng)) {
                    haltestellen.push(h);
                }
                else {
                    console.error(`Couldn't add ${line}`);
                }
            }
            catch {
                console.error(`Couldn't add ${line}`);
            }
        }
        var client = new Tile38();
        var tasks = haltestellen.map(async h => {
            await client.set('haltestelle', h.id, [h.lat, h.lng], { diva: h.diva });
            await client.set('haltestelle', `${h.id}:name`, h.name, null, { type: "string" });
        });
        await Promise.all(tasks);
        ctx.status = 200;
    }
    else {
        ctx.status = 404;
    }
});

app.listen(3000);