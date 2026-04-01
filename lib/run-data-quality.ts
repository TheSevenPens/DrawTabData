import * as path from "path";
import { fileURLToPath } from "url";
import { runDataQuality } from "./data-quality.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const issues = runDataQuality(dataDir);

if (issues.length === 0) {
  console.log("No data quality issues found.");
} else {
  console.log(`Found ${issues.length} data quality issue(s):\n`);

  // Group by issue type
  const byIssue = new Map<string, typeof issues>();
  for (const issue of issues) {
    const key = issue.issue;
    if (!byIssue.has(key)) byIssue.set(key, []);
    byIssue.get(key)!.push(issue);
  }

  for (const [issueType, group] of byIssue) {
    console.log(`--- ${issueType} (${group.length}) ---`);
    for (const { file, entityId, field, value } of group) {
      const valuePart = value !== undefined ? ` => ${value}` : "";
      console.log(`  ${file} | ${entityId} | ${field}${valuePart}`);
    }
    console.log();
  }
}

process.exit(issues.length > 0 ? 1 : 0);
