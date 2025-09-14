// Minimal stub for 'exceljs' used during offline builds.
// Provides just enough surface to satisfy imports and runtime no-op usage.

class Cell {
  value: any = ''
}

class Row {
  private cells: Cell[]
  constructor(count: number) {
    this.cells = Array.from({ length: count }, () => new Cell())
  }
  getCell(index: number): Cell {
    return this.cells[index - 1] || new Cell()
  }
}

class Worksheet {
  columnCount = 10
  rowCount = 10
  getRow(index: number): Row {
    return new Row(this.columnCount)
  }
}

class Workbook {
  worksheets: Worksheet[] = [new Worksheet()]
  xlsx = {
    load: async (_data: ArrayBuffer) => {
      // no-op
    }
  }
}

export default {
  Workbook
}

