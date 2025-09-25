package events

import (
    "context"
    ev "github.com/xxrenzhe/autoads/pkg/events"
    "github.com/xxrenzhe/autoads/services/offer/internal/domain"
)

// EVAdapter adapts pkg/events.Publisher to the local Publisher interface.
type EVAdapter struct{ p *ev.Publisher }

func NewEVAdapter(p *ev.Publisher) Publisher { return &EVAdapter{p: p} }

func (a *EVAdapter) Publish(ctx context.Context, event DomainEvent) error {
    if a == nil || a.p == nil { return nil }
    et := event.EventType()
    // Normalize event type to standard constants
    if et == "offer.created" { et = ev.EventOfferCreated }
    subject := ""
    if oc, ok := event.(domain.OfferCreatedEvent); ok { subject = oc.OfferID }
    return a.p.Publish(ctx, et, event, ev.WithSource("offer"), ev.WithSubject(subject))
}

