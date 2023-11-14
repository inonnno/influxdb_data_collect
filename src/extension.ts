import * as vscode from 'vscode'
import { InfluxDB, Point } from '@influxdata/influxdb-client'
import * as vsls from 'vsls'

let myStatusBarItem: vscode.StatusBarItem
const url = 'http://localhost:8086/'
const token =
  'ti_h3GnRLq4oLQMSaQZX5WQVqHydIq4iMnzCe5vZ_DOWmJNwLUWg6Ya-O2eprRG02rTRIryXOMxQrmeLy8RVVQ=='
const org = 'myorg'
const bucket = 'test'
const deleteQuery =
  'from(bucket:"test") |> range(start: 0) |> filter(fn: (r) => r._measurement == "temperature")'

const influxDB = new InfluxDB({ url, token })
const queryApi = influxDB.getQueryApi(org)
const myQuery = async () => {
  for await (const { values, tableMeta } of queryApi.iterateRows(deleteQuery)) {
    const o = tableMeta.toObject(values)
    console.log(
      `${o._time} ${o._measurement} in '${o.location}' (${o.sensor_id}): ${o._field}=${o._value}`
    )
  }
}
let documentId = 1
let documentIds: { [key: string]: number } = {}
let operation = ''
export async function activate({ subscriptions }: vscode.ExtensionContext) {
  // register a command that is invoked when the status bar
  // item is selected
  console.log('Active!')
  const myCommandId = 'sample.showSelectionCount'
  subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {}))

  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  )
  myStatusBarItem.command = myCommandId
  subscriptions.push(myStatusBarItem)

  // register some listener that make sure the status bar
  // item always up-to-date
  /*
  subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem)
  )
  subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem)
  )
  */
  const liveShare = await vsls.getApi()
  if (liveShare) {
    subscriptions.push(
      liveShare.onDidChangePeers((e) => {
        const peers = liveShare.peers
        console.log('Peers:', peers)
        e.added.forEach((peer) => {
          console.log('New Peer Joined:', peer)
        })
      })
    )
  }

  vscode.workspace.textDocuments.forEach((document) => {
    const documentUri = document.uri.toString()
    if (!documentIds[documentUri]) {
      documentIds[documentUri] = documentId++
      const id = documentIds[documentUri]
      const initialText = document.getText()
      console.log('Initial add:', initialText, 'in document', id)
      WriteToInfluxDB(initialText, id.toString(), 'open')
    }
  })

  subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (liveShare) {
        const peer_edit = liveShare.getPeerForTextDocumentChangeEvent(event)
        console.log('Peer that is edit:', peer_edit)
      }
      const documentUri = event.document.uri.toString()
      if (!documentIds[documentUri]) {
        documentIds[documentUri] = documentId++
      }
      addTextToInfluxDB(event, event.document)
    })
  )
  subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      const documentUri = document.uri.toString()
      if (!documentIds[documentUri]) {
        documentIds[documentUri] = documentId++
        const id = documentIds[documentUri]
        const initialText = document.getText()
        console.log('Initial add:', initialText, 'in document', id)
        WriteToInfluxDB(initialText, id.toString(), 'open')
      }
    })
  )
  // update status bar item once at start
  //updateStatusBarItem()
}

function updateStatusBarItem(): void {
  const text = getalltext(vscode.window.activeTextEditor)
  myStatusBarItem.text = `$(megaphone) ${text} Add this text to InfluxDB`
  myStatusBarItem.show()
}

function getalltext(editor: vscode.TextEditor | undefined): string {
  let text = ''
  if (editor) {
    text = editor.document.getText()
  }
  return text
}

function WriteToInfluxDB(text: string, id: string, operation: string) {
  const writeApi = influxDB.getWriteApi(org, bucket)
  writeApi.useDefaultTags({ region: 'VSCode Extension' })
  const point1 = new Point('texts')
    .tag('document_id', id)
    .tag('operation', operation)
    .stringField('value', text)
  writeApi.writePoint(point1)
  writeApi.close().then(() => {
    console.log('WRITE FINISHED!')
  })
  vscode.window.showInformationMessage(
    `Operation ${operation} with ${text} in document ${id} has been added to InfluxDB`
  )
}

function addTextToInfluxDB(
  event: vscode.TextDocumentChangeEvent,
  document: vscode.TextDocument
) {
  const id = documentIds[document.uri.toString()]
  const changes = event.contentChanges[0]
  if (changes && changes.hasOwnProperty('text')) {
    const { text, range } = changes
    console.log(changes)
    if (range.start.isEqual(range.end)) {
      console.log('Add: ', text, 'in document', id)
      operation = 'add'
    } else if (text === '') {
      console.log('Delete:', text, 'in document', id)
      operation = 'delete'
    } else {
      console.log('Replace:', text, 'in document', id)
      operation = 'replace'
    }
    WriteToInfluxDB(text, id.toString(), operation)
  }
}
