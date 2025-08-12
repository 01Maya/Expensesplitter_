"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, UserPlus, Trash2, Edit2, Download, Share2, Copy, Check, Calculator } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Participant {
  id: string
  name: string
  color: string
}

interface ExpenseSplit {
  participantId: string
  percentage: number
}

interface Expense {
  id: string
  description: string
  amount: number
  paidBy: string
  date: string
  splits: ExpenseSplit[]
}

interface Currency {
  code: string
  symbol: string
  name: string
}

const currencies: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
]

const colorOptions = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#84cc16",
]

const getRandomColor = () => {
  return colorOptions[Math.floor(Math.random() * colorOptions.length)]
}

const participantColors = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#84cc16",
]

export default function ExpenseSplitter() {
  const { toast } = useToast()

  // State management
  const [participants, setParticipants] = useState<Participant[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [currency, setCurrency] = useState<Currency>(currencies[3]) // Default to INR

  // Dialog states
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Form states
  const [newParticipantName, setNewParticipantName] = useState("")
  const [newParticipantColor, setNewParticipantColor] = useState("")
  const [participantNameError, setParticipantNameError] = useState("")

  // Expense form states
  const [expenseDescription, setExpenseDescription] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expensePaidBy, setExpensePaidBy] = useState("")
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0])
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal")
  const [customSplits, setCustomSplits] = useState<ExpenseSplit[]>([])
  const [expenseErrors, setExpenseErrors] = useState<{ [key: string]: string }>({})

  // Load data from localStorage on mount
  useEffect(() => {
    const savedParticipants = localStorage.getItem("expense-splitter-participants")
    const savedExpenses = localStorage.getItem("expense-splitter-expenses")
    const savedCurrency = localStorage.getItem("expense-splitter-currency")

    if (savedParticipants) {
      setParticipants(JSON.parse(savedParticipants))
    }
    if (savedExpenses) {
      setExpenses(JSON.parse(savedExpenses))
    }
    if (savedCurrency) {
      setCurrency(JSON.parse(savedCurrency))
    }
  }, [])

  // Save data to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem("expense-splitter-participants", JSON.stringify(participants))
  }, [participants])

  useEffect(() => {
    localStorage.setItem("expense-splitter-expenses", JSON.stringify(expenses))
  }, [expenses])

  useEffect(() => {
    localStorage.setItem("expense-splitter-currency", JSON.stringify(currency))
  }, [currency])

  // Calculate balances and settlements
  const { calculatedParticipants, settlements, totalExpenses } = useMemo(() => {
    const participantBalances = participants.map((p) => ({
      ...p,
      totalPaid: 0,
      totalOwed: 0,
      balance: 0,
    }))

    let total = 0

    // Calculate what each person paid and owes
    expenses.forEach((expense) => {
      total += expense.amount

      // Add to what the payer paid
      const payerIndex = participantBalances.findIndex((p) => p.id === expense.paidBy)
      if (payerIndex !== -1) {
        participantBalances[payerIndex].totalPaid += expense.amount
      }

      // Add to what each person owes based on splits
      expense.splits.forEach((split) => {
        const participantIndex = participantBalances.findIndex((p) => p.id === split.participantId)
        if (participantIndex !== -1) {
          const owedAmount = (expense.amount * split.percentage) / 100
          participantBalances[participantIndex].totalOwed += owedAmount
        }
      })
    })

    // Calculate net balance (positive means they should receive, negative means they owe)
    participantBalances.forEach((p) => {
      p.balance = p.totalPaid - p.totalOwed
    })

    // Generate settlements using a simple algorithm
    const settlements: Array<{ from: string; to: string; amount: number }> = []
    const debtors = participantBalances
      .filter((p) => p.balance < 0)
      .map((p) => ({ ...p, balance: Math.abs(p.balance) }))
    const creditors = participantBalances.filter((p) => p.balance > 0)

    // Simple settlement algorithm
    for (const debtor of debtors) {
      let remainingDebt = debtor.balance

      for (const creditor of creditors) {
        if (remainingDebt <= 0 || creditor.balance <= 0) continue

        const settlementAmount = Math.min(remainingDebt, creditor.balance)

        if (settlementAmount > 0.01) {
          // Avoid tiny settlements
          settlements.push({
            from: debtor.id,
            to: creditor.id,
            amount: settlementAmount,
          })

          remainingDebt -= settlementAmount
          creditor.balance -= settlementAmount
        }
      }
    }

    return {
      calculatedParticipants: participantBalances,
      settlements,
      totalExpenses: total,
    }
  }, [participants, expenses])

  const calculateBalances = useMemo(() => {
    const balances: { [participantId: string]: number } = {}

    // Initialize balances
    participants.forEach((p) => {
      balances[p.id] = 0
    })

    // Calculate what each person paid and owes
    expenses.forEach((expense) => {
      // Add what they paid
      balances[expense.paidBy] += expense.amount

      // Subtract what they owe
      expense.splits.forEach((split) => {
        const owedAmount = (expense.amount * split.percentage) / 100
        balances[split.participantId] -= owedAmount
      })
    })

    return balances
  }, [participants, expenses])

  const calculateSettlements = useMemo(() => {
    const balances = calculateBalances
    const settlements: { from: string; to: string; amount: number }[] = []

    const creditors = Object.entries(balances).filter(([_, balance]) => balance > 0.01)
    const debtors = Object.entries(balances).filter(([_, balance]) => balance < -0.01)

    creditors.forEach(([creditorId, creditAmount]) => {
      debtors.forEach(([debtorId, debtAmount]) => {
        if (Math.abs(debtAmount) > 0.01 && creditAmount > 0.01) {
          const settlementAmount = Math.min(creditAmount, Math.abs(debtAmount))

          settlements.push({
            from: debtorId,
            to: creditorId,
            amount: settlementAmount,
          })

          balances[creditorId] -= settlementAmount
          balances[debtorId] += settlementAmount
        }
      })
    })

    return settlements
  }, [calculateBalances])

  // Participant management functions
  const addParticipant = () => {
    const trimmedName = newParticipantName.trim()

    if (!trimmedName) {
      setParticipantNameError("Name is required")
      return
    }

    if (participants.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setParticipantNameError("Name already exists")
      return
    }

    const color = newParticipantColor || participantColors[participants.length % participantColors.length]

    const newParticipant: Participant = {
      id: Date.now().toString(),
      name: trimmedName,
      color,
    }

    setParticipants([...participants, newParticipant])
    setNewParticipantName("")
    setNewParticipantColor("")
    setParticipantNameError("")
    setShowAddParticipant(false)

    toast({
      title: "Participant Added",
      description: `${trimmedName} has been added to the group.`,
    })
  }

  const updateParticipantName = (id: string, newName: string) => {
    const trimmedName = newName.trim()

    if (!trimmedName) return

    if (participants.some((p) => p.id !== id && p.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({
        title: "Name Already Exists",
        description: "Please choose a different name.",
        variant: "destructive",
      })
      return
    }

    setParticipants(participants.map((p) => (p.id === id ? { ...p, name: trimmedName } : p)))
    setEditingParticipant(null)

    toast({
      title: "Name Updated",
      description: `Participant name updated to ${trimmedName}.`,
    })
  }

  const removeParticipant = (id: string) => {
    const hasExpenses = expenses.some((e) => e.paidBy === id || e.splits.some((s) => s.participantId === id))

    if (hasExpenses) {
      toast({
        title: "Cannot Remove",
        description: "This participant has associated expenses.",
        variant: "destructive",
      })
      return
    }

    const participant = participants.find((p) => p.id === id)
    setParticipants(participants.filter((p) => p.id !== id))

    toast({
      title: "Participant Removed",
      description: `${participant?.name} has been removed from the group.`,
    })
  }

  // Expense management functions
  const validateExpenseForm = () => {
    const errors: { [key: string]: string } = {}

    if (!expenseDescription.trim()) {
      errors.description = "Description is required"
    }

    const amount = Number.parseFloat(expenseAmount)
    if (!expenseAmount || isNaN(amount) || amount <= 0) {
      errors.amount = "Valid amount is required"
    }

    if (!expensePaidBy) {
      errors.paidBy = "Please select who paid"
    }

    if (splitType === "custom") {
      const totalPercentage = customSplits.reduce((sum, split) => sum + split.percentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.splits = "Split percentages must total 100%"
      }
    }

    setExpenseErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetExpenseForm = () => {
    setExpenseDescription("")
    setExpenseAmount("")
    setExpensePaidBy("")
    setExpenseDate(new Date().toISOString().split("T")[0])
    setSplitType("equal")
    setCustomSplits([])
    setExpenseErrors({})
    setEditingExpense(null)
  }

  const addOrUpdateExpense = () => {
    if (!validateExpenseForm()) return

    const amount = Number.parseFloat(expenseAmount)
    let splits: ExpenseSplit[]

    if (splitType === "equal") {
      const percentage = 100 / participants.length
      splits = participants.map((p) => ({
        participantId: p.id,
        percentage,
      }))
    } else {
      splits = customSplits
    }

    const expenseData: Expense = {
      id: editingExpense?.id || Date.now().toString(),
      description: expenseDescription.trim(),
      amount,
      paidBy: expensePaidBy,
      date: expenseDate,
      splits,
    }

    if (editingExpense) {
      setExpenses(expenses.map((e) => (e.id === editingExpense.id ? expenseData : e)))
      toast({
        title: "Expense Updated",
        description: "The expense has been updated successfully.",
      })
    } else {
      setExpenses([...expenses, expenseData])
      toast({
        title: "Expense Added",
        description: `${expenseDescription} has been added.`,
      })
    }

    resetExpenseForm()
    setShowAddExpense(false)
  }

  const editExpense = (expense: Expense) => {
    setExpenseDescription(expense.description)
    setExpenseAmount(expense.amount.toString())
    setExpensePaidBy(expense.paidBy)
    setExpenseDate(expense.date)

    // Check if it's an equal split
    const isEqualSplit = expense.splits.every((split) => Math.abs(split.percentage - 100 / participants.length) < 0.01)

    if (isEqualSplit) {
      setSplitType("equal")
      setCustomSplits([])
    } else {
      setSplitType("custom")
      setCustomSplits(expense.splits)
    }

    setEditingExpense(expense)
    setShowAddExpense(true)
  }

  const deleteExpense = (id: string) => {
    const expense = expenses.find((e) => e.id === id)
    setExpenses(expenses.filter((e) => e.id !== id))

    toast({
      title: "Expense Deleted",
      description: `${expense?.description} has been deleted.`,
    })
  }

  // Initialize custom splits when switching to custom mode
  useEffect(() => {
    if (splitType === "custom" && customSplits.length === 0) {
      const equalPercentage = 100 / participants.length
      setCustomSplits(
        participants.map((p) => ({
          participantId: p.id,
          percentage: equalPercentage,
        })),
      )
    }
  }, [splitType, participants, customSplits.length])

  // Export and share functions
  const generateSummaryTextOld = () => {
    const date = new Date().toLocaleDateString()
    let summary = `💰 Expense Split Summary - ${date}\n\n`

    summary += `📊 Total Expenses: ${currency.symbol}${totalExpenses.toFixed(2)}\n`
    summary += `👥 Participants: ${participants.length}\n\n`

    if (settlements.length > 0) {
      summary += `💸 Settlement Required:\n`
      settlements.forEach((settlement) => {
        const fromParticipant = participants.find((p) => p.id === settlement.from)
        const toParticipant = participants.find((p) => p.id === settlement.to)
        if (fromParticipant && toParticipant) {
          summary += `• ${fromParticipant.name} owes ${toParticipant.name}: ${currency.symbol}${settlement.amount.toFixed(2)}\n`
        }
      })
    } else if (expenses.length > 0) {
      summary += `✅ All settled! No payments needed.\n`
    }

    summary += `\n📋 Balance Summary:\n`
    calculatedParticipants.forEach((participant) => {
      const status = participant.balance > 0 ? "to receive" : participant.balance < 0 ? "owes" : "settled"
      summary += `• ${participant.name}: ${currency.symbol}${Math.abs(participant.balance).toFixed(2)} ${status}\n`
    })

    if (expenses.length > 0) {
      summary += `\n📝 Expense Details:\n`
      expenses.forEach((expense) => {
        const payer = participants.find((p) => p.id === expense.paidBy)
        summary += `• ${expense.description}: ${currency.symbol}${expense.amount.toFixed(2)} (paid by ${payer?.name})\n`
      })
    }

    summary += `\n🔗 Created with Expense Splitter`
    return summary
  }

  const generateSummaryText = () => {
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)

    let summary = `💰 Expense Summary\n`
    summary += `Total Expenses: ${currency.symbol}${totalExpenses.toFixed(2)}\n\n`

    summary += `👥 Participants:\n`
    participants.forEach((p) => {
      const balance = calculateBalances[p.id]
      const status =
        balance > 0.01
          ? `gets back ${currency.symbol}${balance.toFixed(2)}`
          : balance < -0.01
            ? `owes ${currency.symbol}${Math.abs(balance).toFixed(2)}`
            : `is settled`
      summary += `• ${p.name}: ${status}\n`
    })

    if (calculateSettlements.length > 0) {
      summary += `\n💸 Settlements Needed:\n`
      calculateSettlements.forEach((settlement) => {
        const fromName = participants.find((p) => p.id === settlement.from)?.name
        const toName = participants.find((p) => p.id === settlement.to)?.name
        summary += `• ${fromName} pays ${currency.symbol}${settlement.amount.toFixed(2)} to ${toName}\n`
      })
    }

    summary += `\n📋 Expense Details:\n`
    expenses.forEach((expense) => {
      const paidByName = participants.find((p) => p.id === expense.paidBy)?.name
      summary += `• ${expense.description}: ${currency.symbol}${expense.amount.toFixed(2)} (paid by ${paidByName})\n`
    })

    return summary
  }

  const exportToHTML = async () => {
    try {
      const summaryText = generateSummaryText()
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Expense Split Summary</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            .section { margin: 20px 0; }
            .settlement { background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 5px 0; }
            .expense { background: #fff; border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 5px; }
            .balance { display: flex; justify-content: space-between; padding: 5px 0; }
            .positive { color: #16a34a; }
            .negative { color: #dc2626; }
            .neutral { color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>💰 Expense Split Summary</h1>
            <p>${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="section">
            <h2>📊 Overview</h2>
            <p><strong>Total Expenses:</strong> ${currency.symbol}${totalExpenses.toFixed(2)}</p>
            <p><strong>Participants:</strong> ${participants.length}</p>
          </div>

          ${
            settlements.length > 0
              ? `
          <div class="section">
            <h2>💸 Settlement Required</h2>
            ${settlements
              .map((settlement) => {
                const fromParticipant = participants.find((p) => p.id === settlement.from)
                const toParticipant = participants.find((p) => p.id === settlement.to)
                return `<div class="settlement">
                <strong>${fromParticipant?.name}</strong> owes <strong>${toParticipant?.name}</strong>: 
                <strong>${currency.symbol}${settlement.amount.toFixed(2)}</strong>
              </div>`
              })
              .join("")}
          </div>
          `
              : expenses.length > 0
                ? `
          <div class="section">
            <h2>✅ All Settled!</h2>
            <p>No payments needed.</p>
          </div>
          `
                : ""
          }

          <div class="section">
            <h2>📋 Balance Summary</h2>
            ${calculatedParticipants
              .map(
                (participant) => `
              <div class="balance">
                <span><strong>${participant.name}:</strong></span>
                <span class="${participant.balance > 0 ? "positive" : participant.balance < 0 ? "negative" : "neutral"}">
                  ${currency.symbol}${Math.abs(participant.balance).toFixed(2)} 
                  ${participant.balance > 0 ? "to receive" : participant.balance < 0 ? "owes" : "settled"}
                </span>
              </div>
            `,
              )
              .join("")}
          </div>

          ${
            expenses.length > 0
              ? `
          <div class="section">
            <h2>📝 Expense Details</h2>
            ${expenses
              .map((expense) => {
                const payer = participants.find((p) => p.id === expense.paidBy)
                return `<div class="expense">
                <strong>${expense.description}</strong><br>
                Amount: ${currency.symbol}${expense.amount.toFixed(2)}<br>
                Paid by: ${payer?.name}<br>
                Date: ${expense.date}
              </div>`
              })
              .join("")}
          </div>
          `
              : ""
          }
        </body>
        </html>
      `

      const blob = new Blob([htmlContent], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `expense-split-${new Date().toISOString().split("T")[0]}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Export Successful",
        description: "Expense summary has been downloaded as HTML file.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the summary.",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = async () => {
    try {
      const summaryText = generateSummaryText()
      await navigator.clipboard.writeText(summaryText)

      toast({
        title: "Copied to Clipboard",
        description: "Expense summary has been copied to your clipboard.",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard. Please try again.",
        variant: "destructive",
      })
    }
  }

  const shareViaWhatsApp = () => {
    try {
      const summaryText = generateSummaryText()
      const encodedText = encodeURIComponent(summaryText)
      const whatsappUrl = `https://wa.me/?text=${encodedText}`

      window.open(whatsappUrl, "_blank")

      toast({
        title: "Opening WhatsApp",
        description: "WhatsApp is opening with your expense summary.",
      })
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Unable to open WhatsApp. Please try again.",
        variant: "destructive",
      })
    }
  }

  const addParticipantNew = () => {
    const trimmedName = newParticipantName.trim()

    if (!trimmedName) {
      setParticipantNameError("Name is required")
      return
    }

    if (participants.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setParticipantNameError("This name already exists")
      return
    }

    const newParticipant: Participant = {
      id: Date.now().toString(),
      name: trimmedName,
      color: newParticipantColor || getRandomColor(),
    }

    setParticipants([...participants, newParticipant])
    setNewParticipantName("")
    setNewParticipantColor("")
    setParticipantNameError("")
    setShowAddParticipant(false)

    toast({
      title: "Participant Added",
      description: `${trimmedName} has been added to the group.`,
    })
  }

  const removeParticipantNew = (id: string) => {
    const hasExpenses = expenses.some(
      (expense) => expense.paidBy === id || expense.splits.some((split) => split.participantId === id),
    )

    if (hasExpenses) {
      toast({
        title: "Cannot Remove",
        description: "This participant has associated expenses. Remove expenses first.",
        variant: "destructive",
      })
      return
    }

    setParticipants(participants.filter((p) => p.id !== id))
    toast({
      title: "Participant Removed",
      description: "Participant has been removed from the group.",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Expense Splitter</h1>
          <p className="text-gray-600">Split expenses fairly among friends</p>
        </div>

        {/* Currency Selector */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="currency" className="text-sm font-medium">
                Currency:
              </Label>
              <Select
                value={currency.code}
                onValueChange={(code) => {
                  const selectedCurrency = currencies.find((c) => c.code === code)
                  if (selectedCurrency) setCurrency(selectedCurrency)
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Participants Section */}
        <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Participants ({participants.length})</CardTitle>
              <Dialog open={showAddParticipant} onOpenChange={setShowAddParticipant}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Person
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Participant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newParticipantName}
                        onChange={(e) => {
                          setNewParticipantName(e.target.value)
                          setParticipantNameError("")
                        }}
                        placeholder="Enter participant name"
                        className={participantNameError ? "border-red-500" : ""}
                      />
                      {participantNameError && <p className="text-sm text-red-500 mt-1">{participantNameError}</p>}
                    </div>
                    <div>
                      <Label>Color (optional)</Label>
                      <div className="flex gap-2 mt-2">
                        {participantColors.map((color) => (
                          <button
                            key={color}
                            className={`w-8 h-8 rounded-full border-2 ${
                              newParticipantColor === color ? "border-gray-800" : "border-gray-300"
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewParticipantColor(color)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addParticipantNew} className="flex-1">
                        Add Participant
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddParticipant(false)
                          setNewParticipantName("")
                          setNewParticipantColor("")
                          setParticipantNameError("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No participants yet. Add someone to get started!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: participant.color }}
                      >
                        {participant.name.charAt(0).toUpperCase()}
                      </div>
                      {editingParticipant === participant.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={participant.name}
                            className="h-8 text-sm"
                            onBlur={(e) => updateParticipantName(participant.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateParticipantName(participant.id, e.currentTarget.value)
                              } else if (e.key === "Escape") {
                                setEditingParticipant(null)
                              }
                            }}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="font-medium">{participant.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingParticipant(participant.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Participant</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {participant.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeParticipantNew(participant.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Balance Summary */}
        {participants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {currency.symbol}
                  {totalExpenses.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Total Expenses</div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{expenses.length}</div>
                <div className="text-sm text-gray-600">Expenses Added</div>
              </CardContent>
            </Card>
            <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{settlements.length}</div>
                <div className="text-sm text-gray-600">Settlements Needed</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expenses Section */}
        {participants.length > 0 && (
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Expenses ({expenses.length})</CardTitle>
                <Dialog
                  open={showAddExpense}
                  onOpenChange={(open) => {
                    setShowAddExpense(open)
                    if (!open) resetExpenseForm()
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingExpense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          value={expenseDescription}
                          onChange={(e) => setExpenseDescription(e.target.value)}
                          placeholder="What was this expense for?"
                          className={expenseErrors.description ? "border-red-500" : ""}
                        />
                        {expenseErrors.description && (
                          <p className="text-sm text-red-500 mt-1">{expenseErrors.description}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="amount">Amount ({currency.symbol})</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={expenseAmount}
                            onChange={(e) => setExpenseAmount(e.target.value)}
                            placeholder="0.00"
                            className={expenseErrors.amount ? "border-red-500" : ""}
                          />
                          {expenseErrors.amount && <p className="text-sm text-red-500 mt-1">{expenseErrors.amount}</p>}
                        </div>

                        <div>
                          <Label htmlFor="date">Date</Label>
                          <Input
                            id="date"
                            type="date"
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="paidBy">Paid by</Label>
                        <Select value={expensePaidBy} onValueChange={setExpensePaidBy}>
                          <SelectTrigger className={expenseErrors.paidBy ? "border-red-500" : ""}>
                            <SelectValue placeholder="Select who paid" />
                          </SelectTrigger>
                          <SelectContent>
                            {participants.map((participant) => (
                              <SelectItem key={participant.id} value={participant.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: participant.color }}
                                  />
                                  {participant.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {expenseErrors.paidBy && <p className="text-sm text-red-500 mt-1">{expenseErrors.paidBy}</p>}
                      </div>

                      <div>
                        <Label>Split Type</Label>
                        <div className="flex gap-4 mt-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="equal"
                              checked={splitType === "equal"}
                              onChange={(e) => setSplitType(e.target.value as "equal" | "custom")}
                            />
                            Equal Split
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              value="custom"
                              checked={splitType === "custom"}
                              onChange={(e) => setSplitType(e.target.value as "equal" | "custom")}
                            />
                            Custom Split
                          </label>
                        </div>
                      </div>

                      {splitType === "custom" && (
                        <div>
                          <Label>Custom Split Percentages</Label>
                          <div className="space-y-2 mt-2">
                            {participants.map((participant) => {
                              const split = customSplits.find((s) => s.participantId === participant.id)
                              return (
                                <div key={participant.id} className="flex items-center gap-3">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div
                                      className="w-4 h-4 rounded-full"
                                      style={{ backgroundColor: participant.color }}
                                    />
                                    <span className="text-sm">{participant.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      value={split?.percentage || 0}
                                      onChange={(e) => {
                                        const percentage = Number.parseFloat(e.target.value) || 0
                                        setCustomSplits((prev) => {
                                          const existing = prev.find((s) => s.participantId === participant.id)
                                          if (existing) {
                                            return prev.map((s) =>
                                              s.participantId === participant.id ? { ...s, percentage } : s,
                                            )
                                          } else {
                                            return [...prev, { participantId: participant.id, percentage }]
                                          }
                                        })
                                      }}
                                      className="w-20 text-center"
                                    />
                                    <span className="text-sm">%</span>
                                  </div>
                                </div>
                              )
                            })}
                            <div className="text-sm text-gray-600 mt-2">
                              Total: {customSplits.reduce((sum, split) => sum + split.percentage, 0).toFixed(1)}%
                              {Math.abs(customSplits.reduce((sum, split) => sum + split.percentage, 0) - 100) >
                                0.01 && <span className="text-red-500 ml-2">Must equal 100%</span>}
                            </div>
                          </div>
                          {expenseErrors.splits && <p className="text-sm text-red-500 mt-1">{expenseErrors.splits}</p>}
                        </div>
                      )}

                      <div className="flex gap-2 pt-4">
                        <Button onClick={addOrUpdateExpense} className="flex-1">
                          {editingExpense ? "Update Expense" : "Add Expense"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddExpense(false)
                            resetExpenseForm()
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No expenses yet. Add an expense to start splitting!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expenses.map((expense) => {
                    const payer = participants.find((p) => p.id === expense.paidBy)
                    return (
                      <div key={expense.id} className="p-4 bg-white rounded-lg border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium">{expense.description}</h3>
                              <Badge variant="secondary">
                                {currency.symbol}
                                {expense.amount.toFixed(2)}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <div className="flex items-center gap-2">
                                <span>Paid by:</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: payer?.color }} />
                                  {payer?.name}
                                </div>
                              </div>
                              <div>Date: {expense.date}</div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {expense.splits.map((split) => {
                                  const participant = participants.find((p) => p.id === split.participantId)
                                  const amount = (expense.amount * split.percentage) / 100
                                  return (
                                    <div
                                      key={split.participantId}
                                      className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded"
                                    >
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: participant?.color }}
                                      />
                                      {participant?.name}: {currency.symbol}
                                      {amount.toFixed(2)} ({split.percentage.toFixed(1)}%)
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => editExpense(expense)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{expense.description}"? This action cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteExpense(expense.id)}
                                    className="bg-red-500 hover:bg-red-600"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Balance Summary */}
        {expenses.length > 0 && (
          <Card className="bg-white/70 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Balance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Individual Balances */}
                <div>
                  <h3 className="font-medium mb-3">Individual Balances</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {calculatedParticipants.map((participant) => (
                      <div key={participant.id} className="p-3 bg-white rounded-lg border">
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: participant.color }}
                          >
                            {participant.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{participant.name}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span>Paid:</span>
                            <span>
                              {currency.symbol}
                              {participant.totalPaid.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Owes:</span>
                            <span>
                              {currency.symbol}
                              {participant.totalOwed.toFixed(2)}
                            </span>
                          </div>
                          <div
                            className={`flex justify-between font-medium ${
                              participant.balance > 0
                                ? "text-green-600"
                                : participant.balance < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }`}
                          >
                            <span>Balance:</span>
                            <span>
                              {participant.balance > 0 ? "+" : ""}
                              {currency.symbol}
                              {participant.balance.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settlements */}
                {settlements.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Settlement Required</h3>
                    <div className="space-y-2">
                      {settlements.map((settlement, index) => {
                        const fromParticipant = participants.find((p) => p.id === settlement.from)
                        const toParticipant = participants.find((p) => p.id === settlement.to)
                        return (
                          <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-5 h-5 rounded-full"
                                    style={{ backgroundColor: fromParticipant?.color }}
                                  />
                                  <span className="font-medium">{fromParticipant?.name}</span>
                                </div>
                                <span className="text-gray-500">owes</span>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-5 h-5 rounded-full"
                                    style={{ backgroundColor: toParticipant?.color }}
                                  />
                                  <span className="font-medium">{toParticipant?.name}</span>
                                </div>
                              </div>
                              <Badge variant="destructive">
                                {currency.symbol}
                                {settlement.amount.toFixed(2)}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {settlements.length === 0 && expenses.length > 0 && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="font-medium text-green-800 mb-2">All Settled!</h3>
                    <p className="text-green-600">No payments needed between participants.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Actions */}
        {expenses.length > 0 && (
          <div className="sticky bottom-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1 bg-transparent hover:bg-blue-50" onClick={exportToHTML}>
                <Download className="w-4 h-4 mr-2" />
                Export HTML
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent hover:bg-green-50" onClick={copyToClipboard}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Summary
              </Button>
              <Button variant="outline" className="flex-1 bg-transparent hover:bg-green-50" onClick={shareViaWhatsApp}>
                <Share2 className="w-4 h-4 mr-2" />
                Share WhatsApp
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
