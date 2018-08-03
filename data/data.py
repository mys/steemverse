import datetime
import json
import pymssql
import sys

import config


data = {}

cur_categories = [
	["life"],
	["photography"],
	["steemit"],
	["introduceyourself"],
	["esteem"],
	["bitcoin"],
	["food"],
	["cryptocurrency"],
	["art"],
	["travel"],
	["dlive"],
	["spanish"],
	["busy"],
	["nature"],
	["health"],
	["news"],
	["music"],
	["blockchain"],
	["crypto"],
	["love"],
	["blog"],
	["steem"],
	["poetry"],
	["funny"],
	["kr"],
	["story"],
	["ulog"],
	["blocktradesworldcup"],
	["writing"],
	["dmania"],
	["photo"],
	["colorchallenge"],
	["ico"],
	["indonesia"],
	["technology"],
	["sports"],
	["money"],
	["gaming"],
	["animal"],
	["dtube"],
	["motivation"],
	["meme"],
	["flower"],
	["animalphotography"],
	["smartphonephotography"],
	["steemhunt"],
	["science"],
	["cervantes"],
	["tasteem"],
	["history"],
	["football"],
	["aceh"],
	["contest"],
	["mgsc"],
	["dsound"],
	["eos"],
	["macrophotography"],
	["foodphotography"],
	["education"],
	["landscapephotography"],
	["introducemyself"],
	["video"],
	["politics"],
	["sport"],
	["animals"],
	["goldenhourphotography"],
	["streetphotography"],
	["flowers"],
	["steepshot"],
	["new"],
	["airdrop"],
	["poem"],
	["deutsch"],
	["utopian-io"],
	["game"],
	["family"],
	["steemchurch"],
	["colourfulphotography"],
	["cn"],
	["artzone"],
	["ethereum"],
	["fun"],
	["zappl"],
	["movie"],
	["architecturalphotography"],
	["business"],
	["steempress"],
	["promo-steem"],
	["inspiration"],
	["vehiclephotography"],
	["tr"],
	["openmic"],
	["nsfw"],
	["venezuela"],
	["introduction"],
	["fruit"],
	["polish"],
	["cat"],
	["quarkchain"],
	["worldcup"]
]


def initData():
	global data
	data = {
		'nodes': [],
		'links': [],
		'snapshot': str(datetime.date.today()),
		'count': 0,
		'max': 0
	}


def connect():
	return pymssql.connect(
		config.server, config.user, config.password, config.database)


def selectCategoryAccounts(category):
	print('category accounts #' + category)
	connection = connect()

	# category
	SQLCommand = ('''

		SELECT distinct TOP 100 
			name,
			FLOOR((CAST(REPLACE(vesting_shares, ' VESTS','') AS float)
				+ CAST(REPLACE(received_vesting_shares, ' VESTS','') AS float) 
				- CAST(REPLACE(delegated_vesting_shares, ' VESTS','') AS float)) 
				/ 2036) as 'STEEM POWER',
			COUNT(Comments.created) as 'COUNT'
		FROM Accounts (NOLOCK)
		LEFT JOIN Comments (NOLOCK) ON Accounts.name = Comments.author
		WHERE category = \'''' + category + '''\'
		AND FLOOR((CAST(REPLACE(vesting_shares, ' VESTS','') AS float)
			+ CAST(REPLACE(received_vesting_shares, ' VESTS','') AS float) 
			- CAST(REPLACE(delegated_vesting_shares, ' VESTS','') AS float)) 
			/ 2036) > 25
		AND Comments.created >= DATEADD(MONTH, -3, GETDATE())
		AND depth = 0
		GROUP BY name, vesting_shares, received_vesting_shares, delegated_vesting_shares
		ORDER BY 'STEEM POWER' DESC
	''')
	cursor = connection.cursor() 
	cursor.execute(SQLCommand)
	for row in cursor:
		duplicate = False

		for node in data['nodes']:
			if node['id'] == row[0]:
				for link in data['links']:
					if link['source'] == row[0]:
						if row[2] > link['strength']:
							node['category'] = '#' + category
							link['target'] = '#' + category
							link['strength'] = 100 if row[2] > 100 else row[2]

							# set to end of list for grouping purposes
							data['nodes'].append(data['nodes'].pop(data['nodes'].index(node)))
						break
				duplicate = True
				break

		if not duplicate:
			data['nodes'].append({ 'id': row[0], 'sp': int(row[1]), 'category': '#' + category })
			data['links'].append({ 'source': row[0], 'target': '#' + category, 'strength': 100 if row[2] > 100 else row[2] })
			# data['count'] += 1
			if data['max'] < row[2]:
				data['max'] = row[2]

	connection.close()


def selectTopCategories():
	connection = connect()
	
	SQLCommand = ('''
		SELECT TOP 100
			category,
			COUNT(DISTINCT author) as 'count'
		FROM comments (NOLOCK)
		WHERE created >= DATEADD(MONTH, -3, GETDATE())
		AND depth = 0
		GROUP BY category
		ORDER BY 'count' DESC
	''')
	cursor = connection.cursor() 
	cursor.execute(SQLCommand)
	cur = cursor.fetchall()
	for row in cur:
		data['nodes'].append({ 'id': '#' + row[0], 'count': row[1], 'type': 'tag' })
		if row[0] == 'steem':
			data['nodes'][-1]['fx'] = 0
			data['nodes'][-1]['fy'] = 0
			data['nodes'][-1]['fz'] = 0

	sumSecondaryTags(cur)

	print(json.dumps(data))
	with open('categories.json', 'w') as file:
		file.write(json.dumps(data))
	
	connection.close()
	return cur


def sumSecondaryTags(cur):
	connection = connect()
	
	for category in cur:
		print('#' + category[0] + ', ' + str(category[1]))
		tempTags = {}
		for tag in cur:
			if category[0] == tag[0]:
				continue
			print(str(datetime.datetime.now()) + ' ' + str(tag))
			SQLCommand = ('''	
				SELECT 
					COUNT(DISTINCT author)
				FROM comments (NOLOCK)
				WHERE created >= DATEADD(MONTH, -3, GETDATE())
				AND category = \'''' + category[0] + '''\' 
				AND depth = 0
				AND ISJSON(json_metadata) > 0
				AND CONTAINS(json_metadata, \'''' + tag[0] + '''\') 
				AND \'''' + tag[0] + '''\' IN (SELECT value FROM OPENJSON(json_metadata, '$.tags'))
			''')
# --AND CONTAINS(JSON_VALUE(json_metadata, '$.tags), \'''' + tag[0] + '''\')
# --AND JSON_VALUE(json_metadata, '$.tags[''' + str(i) + ''']') IS NOT NULL
# --AND JSON_VALUE(json_metadata, '$.tags[''' + str(i) + ''']') = \'''' + tag[0] + '''\' 
			# ''')
			cursor = connection.cursor() 
			cursor.execute(SQLCommand)
			for row in cursor:
				if row[0] > int(category[1] / 5):
					tempTags[tag[0]] = row[0]
					data['links'].append({ 'source': '#' + category[0], 'target': '#' + tag[0], 'strength': round(row[0] / category[1], 2) })

		print(tempTags)
		
	connection.close()


# unused
def selectCategoryTags(category = 'polish'):
	connection = connect()

	sum = 0
	tags = {}

	# category
	SQLCommand = ('''
		SELECT 
			COUNT(*)
		FROM comments (NOLOCK)
		WHERE category = \'''' + category + '''\' 
		AND created >= DATEADD(MONTH, -1, GETDATE())
		AND depth = 0
	''')
	cursor = connection.cursor() 
	cursor.execute(SQLCommand)
	for row in cursor:
		sum += row[0]
		if category not in tags:
			tags[category] = 0
		tags[category] += row[0]
	
	# tags
	for i in range(1, 5):
		SQLCommand = ('''
			SELECT TOP 100
				JSON_VALUE(json_metadata, '$.tags[''' + str(i) + ''']'),
				COUNT(JSON_VALUE(json_metadata, '$.tags[''' + str(i) + ''']')) as 'count'
			FROM comments (NOLOCK)
			WHERE category = \'''' + category + '''\' 
			AND created >= DATEADD(MONTH, -1, GETDATE())
			AND depth = 0
			AND ISJSON(json_metadata) > 0
			AND JSON_VALUE(json_metadata, '$.tags[''' + str(i) + ''']') IS NOT NULL
			GROUP BY JSON_VALUE(json_metadata, '$.tags[''' + str(i) + ''']')
			ORDER BY 'count' DESC
		''')
		cursor = connection.cursor() 
		cursor.execute(SQLCommand)
		cur = cursor.fetchall()

		for row in cur:
			print('count: ' + str(row[0]))
			if row[0] not in tags:
				tags[row[0]] = 0
			tags[row[0]] += row[1]

	for key, value in tags.items():
		data['nodes'].append({ 'id': '#' + key, 'count': value })
		if key == category:
			data['nodes'][-1]['fx'] = 0
			data['nodes'][-1]['fy'] = 0
			data['nodes'][-1]['fz'] = 0

	# sumSecondaryTags(cur)

	print(json.dumps(data))
	connection.close()
	

initData()
cur_categories = selectTopCategories()

initData()
for category in cur_categories:
	selectCategoryAccounts(category[0])

with open('accounts.json', 'w') as file:
	file.write(json.dumps(data))