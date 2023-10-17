import * as vscode from "vscode";
import { InfluxDB, Point } from "@influxdata/influxdb-client";

let myStatusBarItem: vscode.StatusBarItem;
const url = "http://localhost:8086/";
const token =
  "ti_h3GnRLq4oLQMSaQZX5WQVqHydIq4iMnzCe5vZ_DOWmJNwLUWg6Ya-O2eprRG02rTRIryXOMxQrmeLy8RVVQ==";
const org = "myorg";
const bucket = "test";
const deleteQuery =
  'from(bucket:"test") |> range(start: 0) |> filter(fn: (r) => r._measurement == "temperature")';

const influxDB = new InfluxDB({ url, token });
const writeApi = influxDB.getWriteApi(org, bucket);
const queryApi = influxDB.getQueryApi(org);
const myQuery = async () => {
  for await (const { values, tableMeta } of queryApi.iterateRows(deleteQuery)) {
    const o = tableMeta.toObject(values);
    console.log(
      `${o._time} ${o._measurement} in '${o.location}' (${o.sensor_id}): ${o._field}=${o._value}`
    );
  }
};
export function activate({ subscriptions }: vscode.ExtensionContext) {
  // register a command that is invoked when the status bar
  // item is selected
  console.log("Active!");
  const myCommandId = "sample.showSelectionCount";
  subscriptions.push(
    vscode.commands.registerCommand(myCommandId, () => {
      const text = getalltext(vscode.window.activeTextEditor);
      writeApi.useDefaultTags({ region: "west" });
      const point1 = new Point("temperature")
        .tag("sensor_id", "TLM010")
        .floatField("value", text);
      writeApi.writePoint(point1);
      writeApi.close().then(() => {
        console.log("WRITE FINISHED");
      });
      vscode.window.showInformationMessage(
        `Hi, here text: ${text} has been added to InfluxDB`
      );
    })
  );

  // create a new status bar item that we can now manage
  myStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  myStatusBarItem.command = myCommandId;
  subscriptions.push(myStatusBarItem);

  // register some listener that make sure the status bar
  // item always up-to-date
  subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem)
  );
  subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem)
  );

  // update status bar item once at start
  updateStatusBarItem();
}

function updateStatusBarItem(): void {
  const text = getalltext(vscode.window.activeTextEditor);
  myStatusBarItem.text = `$(megaphone) ${text} Add this text to InfluxDB`;
  myStatusBarItem.show();
}

function getalltext(editor: vscode.TextEditor | undefined): string {
  let text = "";
  if (editor) {
    text = editor.document.getText();
  }
  return text;
}