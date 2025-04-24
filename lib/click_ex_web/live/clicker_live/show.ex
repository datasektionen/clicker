defmodule ClickExWeb.ClickerLive.Show do
  alias ClickEx.Clickers
  use ClickExWeb, :live_view

  def render(assigns) do
    ~H"""
    <div class="flex items-center justify-center h-screen bg-base-200">
      <div class="card shadow-xl bg-base-100 p-6 flex flex-col items-center space-y-4">
        <h2 class="text-xl font-semibold">Clicker Count</h2>

        <div class="text-5xl font-bold text-primary">
          {@clicker.count}
        </div>

        <div class="flex space-x-4">
          <button phx-click="dec" class="btn btn-secondary text-2xl px-6">
            -
          </button>
          <button phx-click="inc" class="btn btn-accent text-2xl px-6">
            +
          </button>
        </div>

        <button id="share-btn" phx-hook="ShareButton" class="btn btn-outline btn-info mt-4">
          🔗 Share Clicker
        </button>
      </div>
      
    <!-- Toast -->
      <div id="toast" class="toast toast-top toast-center hidden">
        <div class="alert alert-success">
          <span>Link copied!</span>
        </div>
      </div>
    </div>
    """
  end

  def mount(%{"id" => id}, _session, socket) do
    clicker = Clickers.get_clicker!(id)
    Clickers.subscribe(id)

    {:ok, assign(socket, clicker: clicker)}
  end

  def handle_event("inc", _params, socket) do
    Clickers.inc(socket.assigns.clicker)
    {:noreply, socket}
  end

  def handle_event("dec", _params, socket) do
    Clickers.dec(socket.assigns.clicker)
    {:noreply, socket}
  end

  def handle_info(%Clickers.Clicker{} = clicker, socket) do
    {:noreply, assign(socket, clicker: clicker)}
  end
end
