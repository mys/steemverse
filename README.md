# Steemverse

<center><img src="/img/banner.png" width="80%"></center>

https://steemverse.com

<center><img src="https://www.steem.center/images/5/55/Steem_Logo.png"></center>

[Steem](https://steem.io) top communites 3D force-directed graph visualization. Using [ThreeJS](https://threejs.org) Javascript 3D drawing library and [3D Force-Directed Graph](https://github.com/vasturiano/3d-force-graph) layout engine.</p>

## Installing

```
> git clone https://github.com/mys/steemverse.git
> cd steemverse
> npm install
```
Host 'steemverse' catalog using eg. Apache/nginx

## Data gathering

All data are collected using [SteemSQL](https://steemsql.com) database. 

### SteemSQL configuration

Set SteemSQL connection server, credentials and DB.

`data/config.py` (*secure this file privileges!*)

```
server = ''
user = ''
password = ''
database = ''
```

### Run

```
> python3.6 data/data.py
```

The return will create `categories.json` and `accounts.json` data files.

*This process takes ~2 hours long!*

## Data files

- `categories.json`

```
{
	"nodes": [ 
		{ 
			"id": "#category1",
			"count": 1,
			"type": "tag"
		},
		(...)
	],
	"links": [
		{
			"source": "#category1",
			"target": "#category2".
			"strength": 0.2
		},
		(...),
	],
	"snapshot": "2018-07-27"
}
```

- `accounts.json`

```
{
	"nodes": [ 
		{ 
			"id": "account1",
			"sp": 25,
			"category": "#category1"
		},
		(...)
	],
	"links": [
		{
			"source": "account1",
			"target": "#category1",
			"visible": 0,
			"strength": 1
		},
		(...)
	],
	"snapshot": "2018-07-27"
}
```