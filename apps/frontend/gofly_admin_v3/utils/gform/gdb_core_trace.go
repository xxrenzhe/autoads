//

package gform

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.18.0"
	"go.opentelemetry.io/otel/trace"

	"gofly-admin-v3/utils/tools/gtrace"
)

const (
	traceInstrumentName       = "gofly-admin-v3/utils/gform"
	traceAttrDbType           = "db.type"
	traceAttrDbHost           = "db.host"
	traceAttrDbPort           = "db.port"
	traceAttrDbName           = "db.name"
	traceAttrDbUser           = "db.user"
	traceAttrDbLink           = "db.link"
	traceAttrDbGroup          = "db.group"
	traceEventDbExecution     = "db.execution"
	traceEventDbExecutionCost = "db.execution.cost"
	traceEventDbExecutionRows = "db.execution.rows"
	traceEventDbExecutionTxID = "db.execution.txid"
	traceEventDbExecutionType = "db.execution.type"
)

// addSqlToTracing adds sql information to tracer if it's enabled.
func (c *Core) traceSpanEnd(ctx context.Context, span trace.Span, sql *Sql) {
	if gtrace.IsUsingDefaultProvider() || !gtrace.IsTracingInternal() {
		return
	}
	if sql.Error != nil {
		span.SetStatus(codes.Error, fmt.Sprintf(`%+v`, sql.Error))
	}
	labels := make([]attribute.KeyValue, 0)
	labels = append(labels, gtrace.CommonLabels()...)
	labels = append(labels,
		attribute.String(traceAttrDbType, c.db.GetConfig().Type),
		semconv.DBStatement(sql.Format),
	)
	if c.db.GetConfig().Hostname != "" {
		labels = append(labels, attribute.String(traceAttrDbHost, c.db.GetConfig().Hostname))
	}
	if c.db.GetConfig().Hostport != "" {
		labels = append(labels, attribute.String(traceAttrDbPort, c.db.GetConfig().Hostport))
	}
	if c.db.GetConfig().Dbname != "" {
		labels = append(labels, attribute.String(traceAttrDbName, c.db.GetConfig().Dbname))
	}
	if c.db.GetConfig().Username != "" {
		labels = append(labels, attribute.String(traceAttrDbUser, c.db.GetConfig().Username))
	}
	if filteredLink := c.db.GetCore().FilteredLink(); filteredLink != "" {
		labels = append(labels, attribute.String(traceAttrDbLink, c.db.GetCore().FilteredLink()))
	}
	if group := c.db.GetGroup(); group != "" {
		labels = append(labels, attribute.String(traceAttrDbGroup, group))
	}
	span.SetAttributes(labels...)
	events := []attribute.KeyValue{
		attribute.String(traceEventDbExecutionCost, fmt.Sprintf(`%d ms`, sql.End-sql.Start)),
		attribute.String(traceEventDbExecutionRows, fmt.Sprintf(`%d`, sql.RowsAffected)),
	}
	if sql.IsTransaction {
		if v := ctx.Value(transactionIdForLoggerCtx); v != nil {
			events = append(events, attribute.String(
				traceEventDbExecutionTxID, fmt.Sprintf(`%d`, v.(uint64)),
			))
		}
	}
	events = append(events, attribute.String(traceEventDbExecutionType, string(sql.Type)))
	span.AddEvent(traceEventDbExecution, trace.WithAttributes(events...))
}
